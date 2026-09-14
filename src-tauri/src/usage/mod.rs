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
pub struct ResetCredit {
    expires_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditBalance {
    amount: Option<f64>,
    unlimited: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexUsageSnapshot {
    schema_version: u8,
    provider_id: &'static str,
    plan: Option<String>,
    five_hour: QuotaWindow,
    weekly: QuotaWindow,
    windows: Vec<QuotaWindow>,
    credit_balance: Option<CreditBalance>,
    available_resets: Option<u64>,
    reset_credits: Option<Vec<ResetCredit>>,
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
        Some(value) if value < 10.0 => "critical",
        Some(value) if value < 50.0 => "warning",
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

fn parse_windows(rate_limits: &Value) -> Vec<QuotaWindow> {
    // Never combine a Codex window with another model's quota bucket.
    rate_limit_snapshot(rate_limits)
        .into_iter()
        .flat_map(|value| [value.get("primary"), value.get("secondary")])
        .flatten()
        .filter(|window| window.is_object())
        .map(|window| parse_window(Some(window)))
        .collect()
}

fn find_window_by_duration(rate_limits: &Value, expected_minutes: u64) -> QuotaWindow {
    // Retain legacy fields for old cached snapshots; the UI uses windows.
    parse_windows(rate_limits)
        .into_iter()
        .find(|window| window.reset_duration_seconds == expected_minutes.checked_mul(60))
        .unwrap_or_else(unknown_window)
}

fn rate_limit_snapshot(value: &Value) -> Option<&Value> {
    value
        .get("rateLimitsByLimitId")
        .and_then(|buckets| buckets.get("codex"))
        .filter(|bucket| bucket.is_object())
        .or_else(|| value.get("rateLimits").filter(|bucket| bucket.is_object()))
}

fn parse_credit_balance(value: &Value) -> Option<CreditBalance> {
    let credits = rate_limit_snapshot(value)?.get("credits")?;
    if !credits.is_object() {
        return None;
    }
    let amount = credits
        .get("balance")
        .and_then(|balance| {
            balance
                .as_f64()
                .or_else(|| balance.as_str()?.trim().parse::<f64>().ok())
        })
        .filter(|amount| amount.is_finite() && *amount >= 0.0);
    Some(CreditBalance {
        amount,
        unlimited: credits.get("unlimited").and_then(Value::as_bool) == Some(true),
    })
}

fn parse_reset_credits(value: &Value) -> Option<Vec<ResetCredit>> {
    value
        .get("rateLimitResetCredits")?
        .get("credits")?
        .as_array()
        .map(|credits| {
            credits
                .iter()
                .filter(|credit| credit.get("status").and_then(Value::as_str) == Some("available"))
                .map(|credit| ResetCredit {
                    expires_at: timestamp(credit.get("expiresAt").and_then(Value::as_i64)),
                })
                .collect()
        })
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
            windows: Vec::new(),
            credit_balance: None,
            available_resets: None,
            reset_credits: None,
            consumption_state: "unknown",
            authenticated: false,
            fetched_at: now,
            last_successful_fetch_at: None,
            is_cached: false,
            source_description: "Official Codex app-server account API",
            warnings: Vec::new(),
        });
    }

    if rate_limit_snapshot(&response.rate_limits).is_none() {
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
        windows: parse_windows(&response.rate_limits),
        credit_balance: parse_credit_balance(&response.rate_limits),
        available_resets,
        reset_credits: parse_reset_credits(&response.rate_limits),
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
    fn parses_credit_balance_without_currency_conversion() {
        for balance in [json!("298.8615990000"), json!(298.861599)] {
            let value = json!({"rateLimits":{"credits":{"balance":balance,"hasCredits":true,"unlimited":false}}});
            let parsed = parse_credit_balance(&value).unwrap();
            assert_eq!(parsed.amount, Some(298.861599));
            assert!(!parsed.unlimited);
        }
    }

    #[test]
    fn zero_missing_and_unlimited_balances_are_distinct() {
        let zero = json!({"rateLimits":{"credits":{"balance":"0","hasCredits":false}}});
        assert_eq!(parse_credit_balance(&zero).unwrap().amount, Some(0.0));
        assert!(parse_credit_balance(&json!({"rateLimits":{"credits":null}})).is_none());
        let unlimited = json!({"rateLimits":{"credits":{"balance":null,"unlimited":true}}});
        let parsed = parse_credit_balance(&unlimited).unwrap();
        assert!(parsed.unlimited);
        assert_eq!(parsed.amount, None);
    }

    #[test]
    fn rejects_invalid_balances_and_does_not_mix_buckets() {
        for balance in [
            json!(""),
            json!("NaN"),
            json!("inf"),
            json!("-1"),
            json!("USD 12"),
            json!(true),
        ] {
            let value = json!({"rateLimits":{"credits":{"balance":balance}}});
            assert_eq!(parse_credit_balance(&value).unwrap().amount, None);
        }
        let value = json!({"rateLimits":{"credits":{"balance":"100"}},
            "rateLimitsByLimitId":{"codex":{"primary":null}}});
        assert!(parse_credit_balance(&value).is_none());
    }

    #[test]
    #[ignore = "Read-only: requires a signed-in local Codex account with a finite credit balance"]
    fn live_credit_balance_reaches_snapshot() {
        let snapshot = fetch_usage().expect("read account usage");
        let balance = snapshot.credit_balance.expect("credit balance returned");
        assert!(balance
            .amount
            .is_some_and(|amount| amount.is_finite() && amount >= 0.0));
        println!("Credit balance parsed successfully; no raw account data logged");
    }

    #[test]
    fn preserves_weekly_only_pro_snapshot() {
        let response = json!({"rateLimits":{"planType":"pro","primary":{
            "usedPercent":23,"windowDurationMins":10080},"secondary":null}});
        let windows = parse_windows(&response);
        assert_eq!(windows.len(), 1);
        assert_eq!(windows[0].remaining_percent, Some(77.0));
        assert_eq!(windows[0].reset_duration_seconds, Some(604800));
    }

    #[test]
    fn preserves_other_and_unknown_durations() {
        let response = json!({"rateLimits":{"primary":{"usedPercent":0,"windowDurationMins":1440},
            "secondary":{"usedPercent":100}}});
        let windows = parse_windows(&response);
        assert_eq!(windows.len(), 2);
        assert_eq!(windows[0].reset_duration_seconds, Some(86400));
        assert_eq!(windows[0].remaining_percent, Some(100.0));
        assert_eq!(windows[1].reset_duration_seconds, None);
        assert_eq!(windows[1].remaining_percent, Some(0.0));
    }

    #[test]
    fn absent_windows_do_not_mean_unlimited() {
        let response = json!({"rateLimits":{"primary":null,"secondary":null,
            "credits":{"unlimited":true}}});
        assert!(parse_windows(&response).is_empty());
    }

    #[test]
    fn adaptive_windows_do_not_mix_buckets() {
        let response = json!({"rateLimits":{"primary":{"usedPercent":99,"windowDurationMins":300}},
            "rateLimitsByLimitId":{"codex":{"secondary":{"usedPercent":20,"windowDurationMins":1440}},
            "other":{"primary":{"usedPercent":90,"windowDurationMins":300}}}});
        let windows = parse_windows(&response);
        assert_eq!(windows.len(), 1);
        assert_eq!(windows[0].remaining_percent, Some(80.0));
        assert_eq!(windows[0].reset_duration_seconds, Some(86400));
    }

    #[test]
    fn retains_available_credit_expirations_without_identifiers() {
        let response = json!({"rateLimitResetCredits":{"availableCount":2,"credits":[
            {"id":"not-for-renderer","status":"available","expiresAt":1791091536},
            {"status":"redeemed","expiresAt":1791091536},
            {"status":"expired","expiresAt":1791091536},
            {"status":"available","expiresAt":1791155652}
        ]}});
        let credits = parse_reset_credits(&response).unwrap();
        assert_eq!(credits.len(), 2);
        assert_eq!(
            credits[0].expires_at.as_deref(),
            Some("2026-10-04T05:25:36+00:00")
        );
        assert_eq!(
            serde_json::to_value(&credits).unwrap()[0]
                .as_object()
                .unwrap()
                .len(),
            1
        );
    }

    #[test]
    fn distinguishes_missing_details_from_no_available_credits() {
        assert!(parse_reset_credits(&json!({})).is_none());
        assert!(parse_reset_credits(&json!({"rateLimitResetCredits":{"credits":null}})).is_none());
        assert!(
            parse_reset_credits(&json!({"rateLimitResetCredits":{"credits":[]}}))
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn invalid_credit_expiration_stays_unknown() {
        let response = json!({"rateLimitResetCredits":{"credits":[
            {"status":"available"}, {"status":"available","expiresAt":"bad"},
            {"status":"available","expiresAt":9223372036854775807_i64}
        ]}});
        assert!(parse_reset_credits(&response)
            .unwrap()
            .iter()
            .all(|credit| credit.expires_at.is_none()));
    }

    #[test]
    #[ignore = "Requires a signed-in local Codex with reset credits; read-only account request"]
    fn live_reset_credit_expirations_reach_snapshot() {
        let snapshot = fetch_usage().expect("read local Codex account usage");
        let credits = snapshot
            .reset_credits
            .expect("reset-credit details returned");
        assert!(!credits.is_empty());
        assert!(credits.iter().all(|credit| credit.expires_at.is_some()));
        println!("resetCredits={}", serde_json::to_string(&credits).unwrap());
    }

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

    #[test]
    fn prefers_codex_bucket_and_does_not_mix_models() {
        let response = json!({
            "rateLimits": {"primary":{"usedPercent":99,"windowDurationMins":300}},
            "rateLimitsByLimitId": {
                "codex":{"secondary":{"usedPercent":20,"windowDurationMins":10080}},
                "other":{"primary":{"usedPercent":90,"windowDurationMins":300}}
            }
        });
        assert_eq!(
            find_window_by_duration(&response, 300).remaining_percent,
            None
        );
        assert_eq!(
            find_window_by_duration(&response, 10080).remaining_percent,
            Some(80.0)
        );
    }

    #[test]
    fn accepts_named_bucket_without_legacy_snapshot() {
        let response = json!({"rateLimitsByLimitId":{"codex":{"primary":{"usedPercent":40,"windowDurationMins":300}}}});
        assert!(rate_limit_snapshot(&response).is_some());
        assert_eq!(
            find_window_by_duration(&response, 300).remaining_percent,
            Some(60.0)
        );
    }
}
