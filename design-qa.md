# Design QA — v0.2.2

The README preview (`assets/codex-quota-dot-ui.jpg`) is made from the current running frontend, not the original design mockup. Screenshots use demo data.

- Detail card: 320 × 256 logical pixels; orb: 56 px inside a 64 px transparent window.
- Browser checks: healthy/caution/critical colors, 0% and 100%, unavailable and weekly-only quotas, English/Chinese, saved/error states, reset-expiration list, and pin visual feedback.
- Interaction checks: click and Enter expand, Escape collapses, drag gesture does not accidentally expand. The orb has no hover-open handler.
- Labels and progress bars share a row; reset-credit value and View action share a text baseline.
- Available reset-credit dates are sorted and formatted in local time, with bounded scrolling for longer lists.
- Control icons retain their original SVG paths after removing the icon dependency.

Local Windows compilation, frontend tests, Rust formatting/Clippy/tests, and a read-only live Codex expiration test were checked during development. Browser checks do not verify native OS window placement, multi-monitor DPI, or real always-on-top behavior. Native Windows interaction was checked on earlier releases; this revision and macOS still need a hands-on target-device pass for those behaviors.
