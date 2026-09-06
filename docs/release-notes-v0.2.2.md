# Codex Quota Dot v0.2.2

这次主要做减法：窗口更小，信息更整齐，小球也更干净了。

- 展开卡片缩至 **320 × 256**，悬浮球本体 **56 px**（随系统 DPI 缩放）。
- 保留圆润的额度条，把健康状态放到同一行；小球去掉活动圆点，改用圆头额度环。
- 修复“查看”不显示重置机会到期时间的问题，现在逐条显示本地时间，并按最近到期排序。
- 修复缓存／未登录／请求失败状态、Codex 额度桶选择和预览 0% 的问题。
- 移除图标库，改用相同的三个内联 SVG；删除未使用的旧时间工具和移动端图标，不引入服务端或同步功能。

Hover still never expands the orb. Click to open, drag to move, and press Escape to collapse. Existing settings and local Codex authentication are retained.

Quota windows depend on what Codex currently returns. A missing five-hour window is not displayed as 0%: the widget falls back to weekly quota when available.

## Verification and limits

- Local frontend tests, Rust tests and a read-only live reset-expiration check passed.
- Browser checks cover the latest layout and interactions. Native multi-monitor/DPI behavior and hands-on macOS interaction remain unverified for this visual revision.
- Packages are unsigned. Check the adjacent SHA-256 file; do not disable security software to run the app.
