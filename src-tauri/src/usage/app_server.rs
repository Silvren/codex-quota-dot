use super::UsageError;
use serde_json::{json, Value};
use std::{
    env,
    ffi::OsString,
    io::{self, BufRead, BufReader, Write},
    process::{Child, Command, Stdio},
    sync::mpsc::{self, Receiver},
    thread,
    time::{Duration, Instant},
};

#[cfg(target_os = "windows")]
use std::fs;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub struct AccountUsageResponse {
    pub account: Value,
    pub rate_limits: Value,
}

#[cfg(target_os = "windows")]
fn desktop_codex_binary() -> Option<OsString> {
    let base = env::var_os("LOCALAPPDATA")?;
    let root = std::path::PathBuf::from(base)
        .join("OpenAI")
        .join("Codex")
        .join("bin");
    fs::read_dir(root)
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path().join("codex.exe"))
        .filter(|path| path.is_file())
        .max_by_key(|path| fs::metadata(path).and_then(|meta| meta.modified()).ok())
        .map(Into::into)
}

#[cfg(target_os = "macos")]
fn desktop_codex_binary() -> Option<OsString> {
    [
        "/Applications/Codex.app/Contents/Resources/codex",
        "/Applications/Codex.app/Contents/MacOS/codex",
    ]
    .into_iter()
    .map(std::path::Path::new)
    .find(|path| path.is_file())
    .map(|path| path.as_os_str().to_owned())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn desktop_codex_binary() -> Option<OsString> {
    None
}

fn codex_binary() -> OsString {
    env::var_os("CODEX_BINARY")
        .or_else(desktop_codex_binary)
        .unwrap_or_else(|| "codex".into())
}

fn receive_id(receiver: &Receiver<Value>, id: u64, timeout: Duration) -> Result<Value, UsageError> {
    let deadline = Instant::now() + timeout;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        let message = receiver
            .recv_timeout(remaining)
            .map_err(|_| UsageError("Codex app-server timed out"))?;
        if message.get("id").and_then(Value::as_u64) != Some(id) {
            continue;
        }
        if message.get("error").is_some() {
            return Err(UsageError("Codex app-server rejected the usage request"));
        }
        return message
            .get("result")
            .cloned()
            .ok_or(UsageError("Codex app-server returned an invalid response"));
    }
}

fn send(stdin: &mut impl Write, value: Value) -> Result<(), UsageError> {
    serde_json::to_writer(&mut *stdin, &value)
        .map_err(|_| UsageError("Could not encode the Codex request"))?;
    stdin
        .write_all(b"\n")
        .and_then(|_| stdin.flush())
        .map_err(|_| UsageError("Could not communicate with Codex app-server"))
}

fn shutdown_child(child: &mut Child, timeout: Duration) -> io::Result<()> {
    // EOF lets app-server finish outstanding work before exiting. Forced
    // termination is only a fallback for a child that does not exit in time.
    drop(child.stdin.take());
    let deadline = Instant::now() + timeout;
    loop {
        if child.try_wait()?.is_some() {
            return Ok(());
        }
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            break;
        }
        thread::sleep(remaining.min(Duration::from_millis(25)));
    }
    if let Err(error) = child.kill() {
        // The process may have exited between the last poll and kill.
        if child.try_wait()?.is_none() {
            return Err(error);
        }
    }
    child.wait()?;
    Ok(())
}

pub fn read_account_usage() -> Result<AccountUsageResponse, UsageError> {
    let binary = codex_binary();
    let mut command = Command::new(binary);
    command
        .args(["app-server", "--stdio"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    // A GUI application must explicitly suppress the console of each child
    // process. Without this flag, every periodic app-server refresh briefly
    // flashes a terminal window on Windows even though our own binary uses the
    // windows subsystem.
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    read_account_usage_from_command(command)
}

fn read_account_usage_from_command(
    mut command: Command,
) -> Result<AccountUsageResponse, UsageError> {
    let mut child = command
        .spawn()
        .map_err(|_| UsageError("Codex CLI was not found or could not be started"))?;
    let result = (|| {
        // Keep the taken pipe inside this scope so every return path sends EOF
        // before shutdown_child waits, including protocol and setup errors.
        let mut stdin = child
            .stdin
            .take()
            .ok_or(UsageError("Codex app-server input was unavailable"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or(UsageError("Codex app-server output was unavailable"))?;
        let (sender, receiver) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if let Ok(value) = serde_json::from_str::<Value>(&line) {
                    let _ = sender.send(value);
                }
            }
        });

        send(
            &mut stdin,
            json!({"method":"initialize","id":1,"params":{"clientInfo":{"name":"codex_quota_dot","title":"Codex Quota Dot","version":env!("CARGO_PKG_VERSION")},"capabilities":{}}}),
        )?;
        receive_id(&receiver, 1, Duration::from_secs(10))?;
        send(&mut stdin, json!({"method":"initialized","params":{}}))?;
        send(
            &mut stdin,
            json!({"method":"account/read","id":2,"params":{"refreshToken":false}}),
        )?;
        let account = receive_id(&receiver, 2, Duration::from_secs(10))?;
        if account.get("account").is_none_or(Value::is_null) {
            return Ok(AccountUsageResponse {
                account,
                rate_limits: json!({}),
            });
        }
        send(
            &mut stdin,
            json!({"method":"account/rateLimits/read","id":3}),
        )?;
        let rate_limits = receive_id(&receiver, 3, Duration::from_secs(15))?;
        Ok(AccountUsageResponse {
            account,
            rate_limits,
        })
    })();
    let shutdown = shutdown_child(&mut child, Duration::from_secs(5));
    match result {
        Ok(response) => shutdown
            .map(|()| response)
            .map_err(|_| UsageError("Could not shut down Codex app-server")),
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, time::SystemTime};

    fn mock_command(mode: &str) -> (Command, std::path::PathBuf) {
        let nonce = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let marker = env::temp_dir().join(format!(
            "quota-dot-eof-{}-{mode}-{nonce}",
            std::process::id()
        ));
        let mut command = Command::new(env::current_exe().unwrap());
        command
            .args([
                "--ignored",
                "--exact",
                "usage::app_server::tests::mock_app_server",
                "--nocapture",
            ])
            .env("QUOTA_DOT_MOCK_MODE", mode)
            .env("QUOTA_DOT_MOCK_EOF", &marker)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        (command, marker)
    }

    #[test]
    #[ignore = "Subprocess fixture; never starts the real Codex CLI"]
    fn mock_app_server() {
        let mode = env::var("QUOTA_DOT_MOCK_MODE").expect("fixture mode");
        for line in io::stdin().lock().lines() {
            let request: Value = serde_json::from_str(&line.unwrap()).unwrap();
            let Some(id) = request.get("id").and_then(Value::as_u64) else {
                continue;
            };
            let response = match id {
                1 => json!({"id":id,"result":{}}),
                2 if mode == "timeout" => continue,
                2 if mode == "signed-out" => json!({"id":id,"result":{"account":null}}),
                2 => json!({"id":id,"result":{"account":{"planType":"pro"}}}),
                3 if mode == "rejected" => json!({"id":id,"error":{"code":-1}}),
                3 => json!({"id":id,"result":{"rateLimits":{"primary":{"usedPercent":23}}}}),
                _ => panic!("unexpected request"),
            };
            send(&mut io::stdout().lock(), response).unwrap();
        }
        if mode == "hung" {
            thread::sleep(Duration::from_secs(60));
        }
        // Delayed exit verifies that the parent waits after EOF instead of
        // immediately killing a child that is still finishing its cleanup.
        thread::sleep(Duration::from_millis(50));
        fs::write(env::var_os("QUOTA_DOT_MOCK_EOF").unwrap(), "clean exit").unwrap();
        std::process::exit(0);
    }

    #[test]
    fn successful_refresh_allows_graceful_exit() {
        let (command, marker) = mock_command("success");
        let response = read_account_usage_from_command(command).unwrap();
        assert_eq!(response.account["account"]["planType"], "pro");
        assert_eq!(
            response.rate_limits["rateLimits"]["primary"]["usedPercent"],
            23
        );
        assert_eq!(fs::read_to_string(&marker).unwrap(), "clean exit");
        fs::remove_file(marker).unwrap();
    }

    #[test]
    fn signed_out_refresh_also_closes_stdin() {
        let (command, marker) = mock_command("signed-out");
        let response = read_account_usage_from_command(command).unwrap();
        assert!(response.account["account"].is_null());
        assert_eq!(response.rate_limits, json!({}));
        assert!(marker.exists());
        fs::remove_file(marker).unwrap();
    }

    #[test]
    fn rejected_request_preserves_error_and_exits_gracefully() {
        let (command, marker) = mock_command("rejected");
        let error = read_account_usage_from_command(command).err().unwrap();
        assert_eq!(error.0, "Codex app-server rejected the usage request");
        assert!(marker.exists());
        fs::remove_file(marker).unwrap();
    }

    #[test]
    fn timed_out_request_still_exits_gracefully() {
        let (command, marker) = mock_command("timeout");
        let error = read_account_usage_from_command(command).err().unwrap();
        assert_eq!(error.0, "Codex app-server timed out");
        assert!(marker.exists());
        fs::remove_file(marker).unwrap();
    }

    #[test]
    fn missing_stdout_does_not_skip_child_cleanup() {
        let (mut command, marker) = mock_command("no-stdout");
        command.stdout(Stdio::null());
        let error = read_account_usage_from_command(command).err().unwrap();
        assert_eq!(error.0, "Codex app-server output was unavailable");
        assert!(marker.exists());
        fs::remove_file(marker).unwrap();
    }

    #[test]
    fn unresponsive_child_is_killed_and_reaped_after_deadline() {
        let (mut command, marker) = mock_command("hung");
        command.stdout(Stdio::null());
        let mut child = command.spawn().unwrap();
        let started = Instant::now();
        shutdown_child(&mut child, Duration::from_millis(100)).unwrap();
        assert!(started.elapsed() >= Duration::from_millis(100));
        assert!(started.elapsed() < Duration::from_secs(5));
        assert!(!child.try_wait().unwrap().unwrap().success());
        assert!(!marker.exists());
    }
}
