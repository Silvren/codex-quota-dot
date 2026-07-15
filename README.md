# Codex Quota Dot

A lightweight, privacy-first desktop indicator for viewing Codex quota windows without opening a usage page.

> This is an independent open-source project and is not affiliated with or endorsed by OpenAI.

## Current status

`v0.1.0` is release-ready for Windows x64. The compact UI, provider boundary, cache fallback, tray, tests, and release automation are implemented. The Windows build and primary interactions have been verified locally; macOS builds remain CI-validated until they receive a native-device interaction pass.

### What it shows

- ChatGPT plan reported by Codex
- primary (normally 5-hour) and secondary (normally weekly) quota remaining
- reset times and overall health
- best-effort `consuming` / `idle` inference from successive quota changes
- last-update and honest cached/unknown states

The 20 px dot stays on top, can be dragged and snapped to screen edges, and expands into a 280 px card on hover. Click the dot to keep the card open; press `Esc` to close it.

## Privacy design

The native backend starts the installed `codex app-server` and calls its documented `account/read` and `account/rateLimits/read` JSON-RPC methods. Codex itself owns authentication. This app:

- never reads or copies `auth.json`, tokens, cookies, conversations, session rollouts, or project files;
- never passes credentials to the WebView;
- stores only settings, position, and the normalized usage snapshot in WebView local storage;
- has no telemetry, analytics, ads, crash upload, or project server;
- discards Codex subprocess logs and never logs raw account responses.

Codex may contact OpenAI to obtain the usage snapshot, as it normally does. See [`docs/privacy.md`](docs/privacy.md) and [`docs/data-source-research.md`](docs/data-source-research.md).

## Development

Prerequisites:

- Node.js 22+
- Rust stable
- the [Tauri 2 platform prerequisites](https://v2.tauri.app/start/prerequisites/)
- Codex Desktop or Codex CLI available as `codex` (or set `CODEX_BINARY` to its executable)

```powershell
npm install
npm test
npm run typecheck
npm run tauri dev
```

Browser-only preview:

```powershell
npm run dev
```

The browser preview intentionally uses labeled mock data. Native builds never silently fall back to mock values.

Production build:

```powershell
npm run tauri build
```

## Known limitations

- Rust/native build verification is required on every target OS; WebView behavior differs across Windows and macOS.
- Each refresh currently starts a short-lived app-server subprocess. A future release may reuse the supported local daemon transport after lifecycle behavior is validated.
- Native behavior still needs a hands-on pass on each supported macOS architecture before public release.
- Start-at-login is intentionally not included in `v0.1.0`; the settings popover stays limited to theme, refresh interval, and position reset.
- `consuming` is inferred from a decrease between snapshots. It does not mean a Codex task is definitely running.
- The provider depends on the installed Codex version exposing the documented app-server account methods. Structural changes fail closed as `Unknown`.

## Documentation

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/data-source-research.md`](docs/data-source-research.md)
- [`docs/privacy.md`](docs/privacy.md)
- [`docs/security-model.md`](docs/security-model.md)
- [`docs/releasing.md`](docs/releasing.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`SECURITY.md`](SECURITY.md)

## License

[MIT](LICENSE). It is short, permissive, and appropriate for a small cross-platform utility.
