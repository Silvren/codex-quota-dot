# Codex Quota Dot v0.2.3

不是每个账号都同时有五小时和周额度。这次让小球按账号实际返回的数据来显示，不再把单周额度看成缺了一块。

- Pro、Plus 等套餐统一按实际周期显示，不限定套餐名称，也不再只识别固定五小时。
- 只有周额度时，小球显示周额度；展开后显示周剩余、倒计时和下次重置的本地日期／时间。
- 支持其他周期长度；没有周期时长就显示“周期剩余”，不编造五小时。
- 没有额度数据不等于无限额度或 100%；缓存仍会明确标识。
- 跨周期变化不再错误判断为正在消耗。保留既有设置和旧缓存兼容。
- 不添加依赖，窗口仍为 320 × 256，小球仍为 56 px。

Verification: 45 frontend tests and 12 Rust tests passed; the optional signed-in live-credit test was not run for this patch. Chinese/English weekly-only, custom-period, missing-data and default Plus browser previews were checked. Pro scenarios use synthetic fixtures, not a live Pro account. Windows build verified locally; macOS and native multi-monitor behavior have not been re-tested for this patch.

Packages are unsigned. Check the adjacent SHA-256 file before installing.
