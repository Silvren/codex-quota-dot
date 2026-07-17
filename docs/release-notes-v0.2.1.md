# Codex Quota Dot v0.2.1

This patch release corrects the footer alignment in the expanded quota card.

## Fixed

- The short-window fallback and reset-credit columns now share the same top alignment.
- The fallback value row now follows the same vertical rhythm as the reset-credit row.
- The refresh control remains anchored to the bottom of the footer.

## About current Codex quota windows

Quota windows can vary by plan, workspace, promotion, and rollout. Some accounts currently do not receive the traditional 5-hour window from Codex. Codex Quota Dot safely falls back to another supported window or shows a neutral unavailable state; it does not assume that OpenAI has permanently or universally removed the window.

## Privacy

Codex Quota Dot queries the installed Codex app-server. It does not read or copy `auth.json`, tokens, cookies, conversation history, or project files, and it contains no telemetry or analytics.

## Verification

- Browser visual checks for normal, weekly-fallback, and unavailable states
- Windows x64 native build
- TypeScript, ESLint, Vitest, Rust tests, rustfmt, and Clippy
- GitHub Actions builds for Windows x64, macOS Apple Silicon, and macOS Intel
