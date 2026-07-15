# Design QA

- Source visual truth: `C:\Users\ASUS\Documents\Tencent Files\189627153\nt_qq\nt_data\Pic\2026-07\Ori\68549b70f9632299c30faee478262cd6.jpg`
- Supporting focused reference: `output\reference-quota-float\docs\images\quota-states.png`
- Implementation screenshot: `output\design-qa\implementation-full-v1.png`
- Collapsed-state screenshot: `output\design-qa\orb-v2.png`
- Browser viewport: 1280 × 720; compared card region: 320 × 320 CSS px
- State: Chinese, Plus plan, 36% five-hour remaining, 58% weekly remaining, caution palette

## Full-view comparison evidence

The implementation preserves the selected design's square floating-card composition, 38px corner radius, top-left plan and subtitle, top-right three-control cluster, oversized five-hour percentage, single progress lane, compact weekly block, reset-credit row, and lower-right Codex mark. The card is intentionally anchored at the top-left in browser preview because the native Tauri window itself is exactly the card size.

## Focused-region comparison evidence

The supporting 320px Quota Float card reference was compared with the implementation at its native 320px card size. Typography scale, 30px outer padding, 64px primary metric, 6px progress track, footer anchoring, provider-mark scale, action-control diameter, and state-dependent blue/yellow/orange palette match the visible reference structure. A separate focused crop was not required because the supporting reference already presents the card at a directly readable scale.

## Required fidelity surfaces

- Fonts and typography: passed. System display fonts, weights, letter spacing, large numeric hierarchy, and compact support text match the source language.
- Spacing and layout rhythm: passed. Card dimensions, padding, radius, header/action spacing, primary metric, reset line, and footer placement match the target.
- Colors and visual tokens: passed. Healthy, caution, critical, and unavailable palettes coordinate the aurora surface and progress lane while preserving readable foreground contrast.
- Image quality and asset fidelity: passed. The real MIT-licensed Codex mark asset is used; Lucide supplies the pin icon. No placeholder or emoji asset remains.
- Copy and content: passed. Chinese is the default, English toggle works, and plan/quota/reset labels use live provider data.

## Interaction verification

- Expanded the collapsed quota orb.
- Switched Chinese to English and back.
- Toggled always-on-top state.
- Opened reset-credit details.
- Verified refresh control and `Esc` collapse.
- Browser console errors/warnings: none.

## Findings

No actionable P0, P1, or P2 visual differences remain after the native CSP fix.

## Comparison history

- Pass 1 (browser): no P0/P1/P2 visual differences in the rendered card.
- Native pass: P1 provider mark failed to render because Vite inlined the SVG as a data URL while the Tauri CSP allowed only `self` and `asset:` images.
- Fix: added `data:` to the narrow `img-src` directive; no script or connection permission was broadened.
- Post-fix evidence: native Release rebuilt and the provider mark rechecked in the Tauri window.

## Follow-up polish

- P3: exact aurora hue can vary slightly between WebView2 and macOS WebKit color compositing.
- P3: reset-credit expiration dates remain unavailable when the current Codex provider supplies only the count; the UI states this instead of inventing dates.

## Final result

final result: passed
