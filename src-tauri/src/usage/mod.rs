mod app_server;

use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use std::{error::Error, fmt};

#[derive(Debug)]
pub struct UsageError(&'static str);

impl fmt::Display for UsageError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.0)
    }
}
impl Error for UsageError {}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaWindow {
    remaining_percent: Option<f64>,
    used_percent: Option<f64>,
    resets_at: Option<String>,
    reset_duration_seconds: Option<u64>,
    health: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexUsageSnapshot {
    schema_version: u8,
    provider_id: &'static str,
    plan: Option<String>,
    five_hour: QuotaWindow,
    weekly: QuotaWindow,
    available_resets: Option<u64>,
    consumption_state: &'static str,
    authenticated: bool,
    fetched_at: String,
    last_successful_fetch_at: Option<String>,
    is_cached: bool,
    source_description: &'static str,
    warnings: Vec<String>,
}

fn unknown_window() -> QuotaWindow {
    QuotaWindow {
        remaining_percent: None,
        used_percent: None,
        resets_at: None,
        reset_duration_seconds: None,
        health: "unknown",
    }
}

fn timestamp(value: Option<i64>) -> Option<String> {
    value
        .and_then(|seconds| DateTime::<Utc>::from_timestamp(seconds, 0))
        .map(|date| date.to_rfc3339())
}

fn health(remaining: Option<f64>) -> &'static str {
    match remaining {
        None => "unknown",
        Some(value) if value <= 0.0 => "exhausted",
        Some(value) if value < 20.0 => "critical",
        Some(value) if value <= 50.0 => "warning",
        Some(_) => "healthy",
    }
}

fn parse_window(value: Option<&Value>) -> QuotaWindow {
    let Some(value) = value else {
        return unknown_window();
    };
    let used = value
        .get("usedPercent")
        .and_then(Value::as_f64)
        .map(|number| number.clamp(0.0, 100.0));
    let remaining = used.map(|number| 100.0 - number);
    let minutes = value.get("windowDurationMins").and_then(Value::as_u64);
    QuotaWindow {
        remaining_percent: remaining,
        used_percent: used,
        resets_at: timestamp(value.get("resetsAt").and_then(Value::as_i64)),
        reset_duration_seconds: minutes.and_then(|number| number.checked_mul(60)),
        health: health(remaining),
    }
}

fn find_window_by_duration(rate_limits: &Value, expected_minutes: u64) -> QuotaWindow {
    let mut snapshots = Vec::new();
    if let Some(default) = rate_limits.get("rateLimits") {
        snapshots.push(default);
    }
    if let Some(by_id) = rate_limits
        .get("rateLimitsByLimitId")
        .and_then(Value::as_object)
    {
        snapshots.extend(by_id.values());
    }
    let window = snapshots
        .into_iter()
        .flat_map(|snapshot| [snapshot.get("primary"), snapshot.get("secondary")])
        .flatten()
        .find(|window| {
            window.get("windowDurationMins").and_then(Value::as_u64) == Some(expected_minutes)
        });
    parse_window(window)
}

pub fn fetch_usage() -> Result<CodexUsageSnapshot, UsageError> {
    let response = app_server::read_account_usage()?;
    let now = Utc::now().to_rfc3339();
    let account = response
        .account
        .get("account")
        .filter(|value| !value.is_null());
    let authenticated = account.is_some();
    let plan = account
        .and_then(|value| value.get("planType"))
        .and_then(Value::as_str)
        .map(str::to_owned);

    if !authenticated {
        return Ok(CodexUsageSnapshot {
            schema_version: 1,
            provider_id: "codex-app-server",
            plan: None,
            five_hour: unknown_window(),
            weekly: unknown_window(),
            available_resets: None,
            consumption_state: "unknown",
            authenticated: false,
            fetched_at: now,
            last_successful_fetch_at: None,
            is_cached: false,
            source_description: "Official Codex app-server account API",
            warnings: Vec::new(),
        });
    }

    if response.rate_limits.get("rateLimits").is_none() {
        return Err(UsageError("Codex returned no rate-limit snapshot"));
    }
    let five_hour = find_window_by_duration(&response.rate_limits, 5 * 60);
    let weekly = find_window_by_duration(&response.rate_limits, 7 * 24 * 60);
    let available_resets = response
        .rate_limits
        .get("rateLimitResetCredits")
        .filter(|value| !value.is_null())
        .and_then(|value| value.get("availableCount"))
        .and_then(Value::as_u64);

    Ok(CodexUsageSnapshot {
        schema_version: 1,
        provider_id: "codex-app-server",
        plan,
        five_hour,
        weekly,
        available_resets,
        consumption_state: "unknown",
        authenticated: true,
        fetched_at: now.clone(),
        last_successful_fetch_at: Some(now),
        is_cached: false,
        source_description: "Official Codex app-server account API",
        warnings: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_and_clamps_window() {
        let parsed = parse_window(Some(
            &json!({"usedPercent": 125.0, "windowDurationMins": 300, "resetsAt": 1767225600}),
        ));
        assert_eq!(parsed.used_percent, Some(100.0));
        assert_eq!(parsed.remaining_percent, Some(0.0));
        assert_eq!(parsed.health, "exhausted");
        assert_eq!(parsed.reset_duration_seconds, Some(18_000));
    }

    #[test]
    fn missing_window_is_unknown() {
        assert_eq!(parse_window(None).health, "unknown");
    }

    #[test]
    fn maps_windows_by_duration_not_primary_role() {
        let response = json!({
            "rateLimits": {"primary":{"usedPercent":23,"windowDurationMins":10080}},
            "rateLimitsByLimitId": {"codex":{"primary":{"usedPercent":23,"windowDurationMins":10080}}}
        });
        assert_eq!(find_window_by_duration(&response, 300).health, "unknown");
        assert_eq!(
            find_window_by_duration(&response, 10080).remaining_percent,
            Some(77.0)
        );
    }
}
