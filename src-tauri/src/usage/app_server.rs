use super::UsageError;
use serde_json::{json, Value};
use std::{
    env,
    ffi::OsString,
    fs,
    io::{BufRead, BufReader, Write},
    process::{Command, Stdio},
    sync::mpsc::{self, Receiver},
    thread,
    time::{Duration, Instant},
};

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

pub fn read_account_usage() -> Result<AccountUsageResponse, UsageError> {
    let binary = codex_binary();
    let mut child = Command::new(binary)
        .args(["app-server", "--stdio"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| UsageError("Codex CLI was not found or could not be started"))?;
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

    let result = (|| {
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
    let _ = child.kill();
    let _ = child.wait();
    result
}
