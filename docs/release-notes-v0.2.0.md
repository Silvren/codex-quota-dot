# Codex Quota Dot v0.2.0

This release replaces the previous hover-driven interface with a smaller, more predictable desktop quota orb.

## Highlights

- Hover provides feedback only; it never opens or closes the card.
- Drag the 72 px orb to reposition it, and click to open the quota details.
- Collapse explicitly with the header control or `Esc`.
- Always-on-top now has a clear active state.
- Healthy, caution, and critical quota levels use distinct surface colors.
- If Codex does not return a short-period quota window, the app falls back to the weekly quota and marks it as `周` / `W`.
- If neither supported window is returned, the app shows a neutral unavailable state rather than reporting a false service error.

## About current Codex quota windows

Quota windows can vary by plan, workspace, promotion, and rollout. Some accounts currently do not receive the traditional 5-hour window from Codex. This release handles that response safely; it does not assume that OpenAI has permanently or universally removed the window.

## Privacy

Codex Quota Dot continues to query the installed Codex app-server. It does not read or copy `auth.json`, tokens, cookies, conversation history, or project files, and it contains no telemetry or analytics.

## Verification

- Windows x64 native interaction pass
- TypeScript, ESLint, Vitest, Rust tests, rustfmt, and Clippy
- GitHub Actions builds for Windows x64, macOS Apple Silicon, and macOS Intel
