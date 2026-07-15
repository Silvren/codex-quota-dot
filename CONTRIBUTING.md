# Contributing

Please open an issue before large architectural changes. Keep providers isolated from UI code, never add credential parsing, and add tests for external-data parsing and failure behavior.

Before a pull request, run `npm test`, `npm run typecheck`, `npm run build`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, and `cargo test`.
