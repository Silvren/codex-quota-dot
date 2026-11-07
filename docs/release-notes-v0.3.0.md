# Codex Quota Dot v0.3.0

小球现在能同时看两个周期了。

- 上方短弧显示较短周期，下方长弧显示另一个周期；每条弧单独按剩余量显示蓝、琥珀或珊瑚色。
- 鼠标指向哪条弧，中央数字和周期标签就切到哪一条；提示中也会显示对应的剩余额度。
- 只有周额度时显示单环；周期完全按 Codex 返回的数据决定。
- 保留 56 px 尺寸、点击展开、拖动移动。键盘上下键可以切换周期，Enter 或空格展开。

这版也包含 v0.2.5 的 app-server 正常退出修复和依赖更新。感谢 @derekhe 的 #7。

CLI 本身也能在终端状态栏显示额度，使用 `/statusline` 配置。这个项目提供的是常驻桌面、切到其他窗口后仍能看到的额度显示。

## English

The orb now displays two quota periods as separate arcs, with independent health colors. Hover either arc to inspect its remaining percentage and period, or use the arrow keys when the orb has keyboard focus. Accounts reporting one quota period get a single ring.

The orb stays 56 px. Click to expand and drag to reposition work as before. This release includes the graceful app-server shutdown fix from v0.2.5.

Packages remain unsigned; SHA-256 files accompany the downloads.
