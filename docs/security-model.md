# Security model

## Assets

- Codex authentication material (must remain owned by Codex)
- normalized quota state
- user trust in release artifacts

## Trust boundaries

- React/WebView is treated as less privileged than Rust.
- Rust spawns only the configured/discoverable Codex executable with fixed arguments.
- Codex owns upstream authentication and response acquisition.
- GitHub Actions owns unsigned release assembly; signing secrets are optional and must remain in repository secrets.

## Controls

- no Tauri shell or filesystem capability is exposed to the renderer;
- a restrictive CSP permits packaged assets and Tauri IPC only;
- protocol requests are constant and response fields are allow-listed during normalization;
- subprocess stderr and JSON-RPC error bodies are not logged or returned;
- refresh has bounded protocol timeouts and the child is killed after each attempt;
- cached data is visibly labeled;
- no remote content is rendered.

## Residual risks

- `CODEX_BINARY` is an advanced override: if the local environment points it to an untrusted executable, that executable runs with the user's privileges. Do not set it to untrusted software.
- A compromised Codex executable can return deceptive data; this project trusts the installed Codex runtime.
- Unsigned downloads can trigger OS warnings and offer weaker publisher identity. Users should verify SHA-256 files until signed releases exist.
- Local WebView storage is not encrypted because it contains only sanitized quota data, but another same-user process may still read it.
