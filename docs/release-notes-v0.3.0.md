# Codex Quota Dot v0.3.0

小球现在以单环显示实际返回的周额度。

- Plus、Pro 等套餐使用相同规则，小球只显示实际返回的周额度，不按套餐名切换周期。
- 小球按周剩余比例显示颜色；周额度数据缺失时显示 `—`，不回退到短周期额度。
- 展开卡片仍保留实际返回的短周期和周额度详情。
- 保留 56 px 尺寸、点击展开和拖动移动；Enter 仍可展开。
- 点击卡片外的桌面区域会自动收起；卡片内按钮正常使用。

这版也包含 v0.2.5 的 app-server 正常退出修复和依赖更新。感谢 @derekhe 的 #7。

CLI 本身也能在终端状态栏显示额度，使用 `/statusline` 配置。这个项目提供的是常驻桌面、切到其他窗口后仍能看到的额度显示。

## English

The orb now displays the reported weekly quota as a single ring for all plans. The ring color reflects the remaining percentage; when weekly data is unavailable, it shows `—` instead of falling back to a short-period quota. The expanded card retains the available short-period and weekly details.

The orb stays 56 px. Click or press Enter to expand and drag to reposition as before. Clicking outside the card collapses it back to the orb. This release includes the graceful app-server shutdown fix from v0.2.5.

Packages remain unsigned; SHA-256 files accompany the downloads.
