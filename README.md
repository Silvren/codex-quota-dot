# Codex Quota Dot

A lightweight, privacy-first desktop indicator for viewing Codex quota windows without opening a usage page.

> This is an independent open-source project and is not affiliated with or endorsed by OpenAI.

中文简介：一个轻量、隐私优先的 Codex 配额桌面悬浮球，无需打开用量页面即可查看当前可用的短周期或每周额度、重置时间和消耗状态。

## Interface preview

![Codex Quota Dot interface, collapsed mode, and quota health colors](assets/codex-quota-dot-ui-showcase.jpg)

The surface changes with the active quota window: blue for healthy (`50–100%`), amber for caution (`10–50%`), and coral for critical (`0–10%`). If Codex omits the short window, the orb falls back to weekly quota and displays a `周` / `W` marker.

## Download

Download the latest build from [GitHub Releases](https://github.com/Silvren/codex-quota-dot/releases/latest):

- Windows x64
- macOS Apple Silicon
- macOS Intel

## Current status

`v0.2.0` replaces the previous interface with a smaller click-to-open quota orb and an explicit, persistent detail card. Windows x64 has received a native interaction pass; macOS builds are produced by CI and remain pending a hands-on native-device interaction pass.

### What it shows

- ChatGPT plan reported by Codex
- the currently available short-period and weekly quota windows
- reset times and overall health
- best-effort `consuming` / `idle` inference from successive quota changes
- last-update and honest cached/unknown states

The compact 72 px quota orb stays on top and shows the active quota percentage. Drag it to reposition and snap it to a screen edge; click it to open the 480 × 360 quota card. Hover never opens or closes the card. Use the explicit collapse control or press `Esc` to return to the orb. The card includes Chinese/English switching and a clearly indicated always-on-top toggle.

## Quota-window availability

Codex quota policy and the windows returned by `account/rateLimits/read` can vary by plan, workspace, promotion, and rollout. Some accounts may temporarily receive no traditional 5-hour window. Codex Quota Dot treats this as an unavailable window rather than a service failure:

- when a short-period window is available, it remains the primary display;
- when the short-period window is absent but a weekly window exists, the orb automatically displays the weekly value with a `周` / `W` marker;
- when neither window is returned, the app uses a neutral unavailable state and keeps cached data clearly identified.

This project does not claim that OpenAI has permanently or universally removed a specific quota window.

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
- Start-at-login and a full settings screen are intentionally not included in `v0.1.0`; the widget keeps controls limited to language, always-on-top, reset-credit details, and refresh.
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
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)

## License

[MIT](LICENSE). It is short, permissive, and appropriate for a small cross-platform utility.
