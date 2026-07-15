# Releasing

1. Verify `npm run lint`, `npm test`, `npm run typecheck`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, and `cargo test`.
2. Smoke-test the 150 ms hover open, delayed close, click-to-pin, `Esc`, drag, edge snap, settings, tray, offline/cache, and login states on Windows and macOS.
3. Update `CHANGELOG.md` and ensure versions match in `package.json`, `src-tauri/Cargo.toml`, and `tauri.conf.json`.
4. Tag `v0.1.0` and push the tag.
5. Review the draft GitHub Release, platform ZIP files, and `.sha256` files before publishing.

The workflow produces unsigned packages unless signing secrets are configured. Do not claim Windows signing or Apple notarization until the corresponding secrets and workflow steps are verified. On macOS, users may need to approve or remove quarantine from an unsigned build.
