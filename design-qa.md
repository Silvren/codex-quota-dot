# Design QA

- Source visual truth: `D:\Codex\codex-quota-dot\assets\codex-quota-dot-ui-showcase.jpg`
- Primary implementation screenshot: `D:\Codex\codex-quota-dot\output\design-qa\caution-expanded.png`
- Additional states: `healthy-expanded.png`, `critical-expanded.png`, `caution-collapsed.png`, `weekly-fallback.png`
- Viewport: `480 × 360` for the expanded card; collapsed surface rendered inside the same QA viewport
- Primary comparison state: Simplified Chinese, 36% five-hour remaining, caution tier
- Browser: Codex in-app browser

## Full-view comparison evidence

- Combined source and three implementation health states: `D:\Codex\codex-quota-dot\output\design-qa\full-comparison.jpg`
- The combined image verifies the landscape card silhouette, information hierarchy, state-dependent blue/amber/coral surfaces, progress bars, footer grid, and terminal refresh control.

## Focused region comparison evidence

- Source card crop beside the 36% implementation: `D:\Codex\codex-quota-dot\output\design-qa\focused-card-comparison.jpg`
- Focused comparison was required because typography, header controls, divider placement, footer alignment, corner radius, and the compact terminal button are too small to judge reliably in the full presentation board.

## Findings

- No actionable P0, P1, or P2 visual mismatch remains.
- Typography: the hierarchy, weight contrast, numeric scale, line height, and tracking match the reference closely. The implementation uses native SF Pro / Segoe UI Variable / Microsoft YaHei UI fallbacks so glyph metrics remain platform-appropriate.
- Spacing and layout: the final `480 × 360` frame, 35 px radius, 36 px side padding, header rhythm, long progress rail, divider, two-column footer, and refresh control align with the reference card.
- Colors and tokens: healthy uses cool blue, caution uses amber on warm ivory, and critical uses coral on blush. The source board's explicit `50–100%`, `10–50%`, and `0–10%` legend is treated as the semantic truth.
- Image and icon fidelity: the supplied design board is preserved as the README showcase image. Visible UI icons use the existing icon library rather than handcrafted SVG or text-glyph substitutes.
- Copy: plan, five-hour quota, reset countdown, weekly quota, reset credits, activity, language, pin, and refresh labels are present in Chinese and English.

## Interaction verification

- Collapsed orb opens the card on click.
- Hovering the orb for more than one second does not open it.
- Dragging the orb does not accidentally open the card.
- Enter opens the focused orb for keyboard users.
- The explicit collapse control returns to the orb.
- `Esc` returns to the collapsed orb.
- Chinese/English switching updates all visible copy.
- Always-on-top control toggles its pressed state.
- Healthy (74%), caution (36%), and critical (8%) colors were rendered and captured.
- A live native response with no 5-hour window promoted the 57% weekly quota, displayed the `周` marker, and explained the unavailable short-period window without an error state.
- Browser console errors checked: none.

## Comparison history

### Iteration 1

- Earlier evidence: `D:\Codex\codex-quota-dot\output\design-qa\implementation-320-v1.png`
- Earlier P1/P2 findings: the implementation was a `320 × 320` square rather than the source's landscape card; the collapsed widget lacked the reference ring/status composition; header controls were visually enclosed rather than lightweight; state colors did not follow the source legend precisely.
- Fixes: changed the native and web surface to `480 × 360`, rebuilt the card grid and header controls, added a functional quota ring and status dot, and introduced explicit healthy/caution/critical tokens.
- Post-fix evidence: `focused-card-comparison.jpg` and `full-comparison.jpg`.

### Iteration 2

- Earlier P2 findings: first refresh replaced a provider-supplied consumption state with `unknown`, and the pin orientation did not match the diagonal reference icon.
- Fixes: preserved a supplied state when inference is not yet possible and rotated the pin to match the reference.
- Post-fix evidence: `caution-expanded.png`; the header now shows a concrete activity state and the corrected diagonal pin.

## Follow-up polish

- P3: native font rasterization and translucent-window shadow softness can vary slightly between Windows WebView2 and macOS WebKit. These platform-level differences do not affect layout or task completion.

final result: passed
