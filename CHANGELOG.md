# Changelog

## [Unreleased]

## [0.1.0] - 2026-07-15

### Added

- 20 px Tauri 2 floating status dot with edge snapping and a compact 280 px hover card
- official Codex app-server usage provider
- sanitized cache fallback and activity inference
- minimal settings popover, system/light/dark themes, and reduced-motion support
- tray menu, tests, cross-platform CI, and draft release workflow

### Changed

- Reworked the interface into a restrained system-utility layout with only plan, health, two quota windows, reset times, activity, and freshness
- Reduced decoration, shadow weight, control count, and animation while preserving native window behavior
- Refined the expanded card hierarchy so the 5-hour quota is the primary metric and the weekly quota remains a compact secondary reference

### Fixed

- Prevented the Codex app-server child process from flashing a console window during refresh on Windows
- Replaced native select menus whose option text could become invisible in WebView2 dark mode
- Made the card surface reliably opaque on transparent Windows desktops and redesigned the collapsed state as a percentage orb
