# Changelog

## [0.3.0] - 2026-11-07

- Show the two available quota periods as independent arcs: the shorter period above, the longer period below, each with its own remaining percentage and health color.
- Hover an arc to inspect its percentage and period in the orb; use the arrow keys to switch periods from the keyboard.
- Use a single ring when Codex reports only one period, including weekly-only accounts, and keep unavailable data neutral.
- Keep the 56 px orb, click-to-expand card, and drag-to-move interaction.

## [0.2.5] - 2026-11-07

### Fixed

- Close app-server stdin and allow up to five seconds for a normal exit after quota reads; terminate and reap only children that exceed the deadline. Cleanup also covers failed, timed-out, and signed-out requests. Thanks to @derekhe for [#7](https://github.com/Silvren/codex-quota-dot/pull/7).
- Add six mock-subprocess regression tests for graceful exit and timeout cleanup.

### Maintenance

- Refresh development dependencies to resolve high-severity npm audit findings.
- Move Apple Silicon CI and release builds to `macos-15` after the previous runner stopped accepting jobs; run the mock app-server lifecycle tests on Windows and macOS too.
- Clarify the widget's role alongside Codex's built-in usage display and keep maintenance focused on compatibility and stability.
- Track the Windows LSASS/RPC report in [#6](https://github.com/Silvren/codex-quota-dot/issues/6). Graceful shutdown addresses the suspected termination race; the underlying crash cause remains open.

## [0.2.4] - 2026-09-17

- Added credit balance to the compact card, using the existing Codex app-server response and refresh flow.
- Label balances in credits, not currency; preserve zero, missing, unlimited and cached states.
- Kept the 320 × 256 card and existing dependencies; refreshed the interface showcase.

## [0.2.3] - 2026-09-07

- Adapted quota display to actual returned periods, including weekly-only and custom-duration windows.
- Kept absent data distinct from unlimited quota and retained old-cache compatibility.

## [0.2.2] - 2026-09-06

### Changed

- Reduced the detail card to 320 × 256 logical pixels and the orb to 56 px; refined spacing, restrained colors, rounded progress indicators and control feedback.
- Removed the orb activity dot; activity remains visible in the expanded card.
- Replaced the icon package with three inline SVG controls and removed unused time helpers and mobile icon assets.

### Fixed

- Display individual reset-credit expiration dates from the official app-server response, sorted by expiration in local time.
- Prefer the Codex quota bucket without mixing limits from other model buckets.
- Preserve explicit zero in browser previews and show cached/error/unauthenticated states honestly.
- Keep reset-credit text aligned, dismiss details on outside click, and prevent refresh subprocess console flashes on Windows.

## [0.2.1] - 2026-07-17

### Fixed

- Aligned the short-window fallback and reset-credit footer columns while preserving the bottom-aligned refresh control.

## [0.2.0] - 2026-07-17

### Changed

- Reworked the quota orb interaction model: hover only provides feedback, drag moves the widget, and click opens the card.
- Added an explicit collapse control and stronger always-on-top state feedback.
- Reduced the collapsed native window to 84 px with a 72 px orb.
- Replaced the old hover-driven interface with an explicit click-to-open card.

### Added

- Weekly-quota fallback with a visible `周` / `W` marker when Codex does not return a short-period window.
- Neutral unavailable messaging when no supported quota window is returned.

## [0.1.0] - 2026-07-15

### Added

- 80 px Tauri 2 quota orb with edge snapping and a 320 px square hover card
- official Codex app-server usage provider
- sanitized cache fallback and activity inference
- bilingual controls, always-on-top toggle, state-responsive color palettes, and reduced-motion support
- tray menu, tests, cross-platform CI, and draft release workflow

### Changed

- Reworked the interface into a restrained system-utility layout with only plan, health, two quota windows, reset times, activity, and freshness
- Reduced decoration, shadow weight, control count, and animation while preserving native window behavior
- Refined the expanded card hierarchy so the 5-hour quota is the primary metric and the weekly quota remains a compact secondary reference
- Rebuilt the widget to match the selected Quota Float-inspired visual target, including its square aurora card, three-control header, reset-credit row, and provider mark

### Fixed

- Prevented the Codex app-server child process from flashing a console window during refresh on Windows
- Replaced native select menus whose option text could become invisible in WebView2 dark mode
- Made the card surface reliably opaque on transparent Windows desktops and redesigned the collapsed state as a percentage orb
