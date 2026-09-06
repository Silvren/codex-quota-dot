# Usage data-source research

Last verified: 2026-07-15

## Decision

Use the official Codex app-server stable JSON-RPC account surface:

1. start `codex app-server --stdio`;
2. send `initialize`, then `initialized`;
3. call `account/read` with `refreshToken: false`;
4. call `account/rateLimits/read`;
5. normalize only plan, quota windows, reset timestamps, and available reset count;
6. terminate the short-lived child process.

The upstream README describes app-server as the interface used to power rich Codex clients. It documents `account/read`, `account/rateLimits/read`, `usedPercent`, `windowDurationMins`, `resetsAt`, `rateLimitResetCredits.availableCount`, and the required initialization sequence:

- [Official `openai/codex` app-server README](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md#auth-endpoints)
- [Official protocol types](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/protocol/v2.rs)

These account methods are documented outside the experimental opt-in surface. WebSocket transport is explicitly experimental, so v0.1 uses the default JSONL stdio transport.

## Why this is acceptable

- Authentication stays inside Codex. This project does not parse, decrypt, copy, or persist credentials.
- The renderer receives a purpose-built schema, not raw account payloads.
- No chat/session/project endpoint is called.
- The child process is invoked with `refreshToken: false`; Codex retains ownership of any normal internal refresh decision.
- The provider fails closed when the executable, method, or expected response is unavailable.

## Alternatives evaluated

| Source | Result | Reason |
|---|---|---|
| Public OpenAI usage HTTP API | Rejected | No public Codex quota endpoint suitable for reusing the Desktop login was identified. |
| Codex app-server account API | Selected | Official source, narrow fields, authentication remains in Codex. |
| Local Codex session rollout JSONL | Rejected | Would touch session/chat-adjacent artifacts; rate-limit fields may also be absent or stale. |
| `auth.json` + direct HTTP request | Prohibited | Exposes credentials to this app and duplicates private auth behavior. |
| Desktop process injection / IPC reverse engineering | Prohibited | Fragile and violates the project's security boundary. |
| Usage-page scraping, cookies, OCR | Prohibited | Fragile, invasive, and unnecessary. |

## Field mapping

| App field | app-server field | Notes |
|---|---|---|
| `plan` | `account/read.result.account.planType` | Nullable. Email is deliberately ignored. |
| `fiveHour.usedPercent` | any window with `windowDurationMins == 300` | UI computes remaining as `100 - used`; missing windows remain unknown. |
| `weekly.usedPercent` | any window with `windowDurationMins == 10080` | Searches both the default snapshot and `rateLimitsByLimitId`. |
| `resetsAt` | window `resetsAt` | Unix seconds converted to RFC 3339 UTC. |
| `availableResets` | `rateLimitResetCredits.availableCount` | Nullable when backend does not supply reset credits. |
| `resetCredits[].expiresAt` | `rateLimitResetCredits.credits[].expiresAt` | Only `status == available`; Unix seconds converted to RFC 3339 UTC, then displayed in local time. IDs and grant descriptions are not retained. |

### Reset-credit expiration verification (2026-09-06)

A read-only request through the same installed Codex app-server used by the widget returned both `availableCount` and per-credit `status`/`expiresAt`. The old adapter dropped the details, and the UI unconditionally showed an unavailable message. The adapter now forwards only available credits' expiration dates. Missing/invalid dates remain unknown, old cached snapshots remain compatible, and the UI orders known dates earliest first. The explicit ignored Rust test `live_reset_credit_expirations_reach_snapshot` checks this path with a signed-in local account without logging identifiers or credentials.

## Compatibility and risks

- App-server startup adds latency, so refresh is limited to once per minute by default.
- Older Codex versions may lack the methods. The UI displays `Unknown` and retains only the last normalized cache.
- `primary` and `secondary` are backend roles, not fixed durations. The provider classifies by `windowDurationMins`; a live 2026-07-15 Plus response exposed a 10080-minute window as `primary` and no 300-minute window. The UI therefore treats the short window as unavailable and promotes the correctly identified weekly window instead of mislabeling it.
- Account switching is owned by Codex. Each fetch starts a fresh child to avoid maintaining stale account state.
- Raw stderr and error payloads are discarded to prevent accidental credential or account metadata logging.

## Reproduction

Set `CODEX_BINARY` only when `codex` is not discoverable, then run the native app. A successful snapshot should report `providerId: codex-app-server`. To test failure, point `CODEX_BINARY` to a missing file and verify that the UI shows `Unknown`/cached data rather than mock percentages.
