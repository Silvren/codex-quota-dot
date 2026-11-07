# Codex Quota Dot v0.2.5

这次更新先把积下来的稳定性问题处理掉。

- 读取额度后，先关闭 app-server 输入并等待正常退出，最多五秒；卡住的进程才强制结束。感谢 @derekhe 的 [#7](https://github.com/Silvren/codex-quota-dot/pull/7)。
- 加入六个模拟子进程测试，覆盖成功、未登录、请求失败、超时和退出清理，并在 Windows、macOS 上运行。
- 更新开发依赖，清除本次审计中的 high / critical 告警。
- 更新 macOS 构建环境，整理中英文说明和维护范围。

Windows LSASS/RPC 崩溃的后续情况继续在 [#6](https://github.com/Silvren/codex-quota-dot/issues/6) 跟进。这次调整的是子进程退出方式。

Codex 自带额度显示后，这个小球的用途更具体了：在终端、编辑器或其他窗口工作时，仍能在桌面上看到额度。需要就用，不需要就少装一个工具。项目会继续跟进兼容性和稳定性，不按月凑功能。

## English

Quota reads now close app-server stdin and allow up to five seconds for normal exit before terminating an unresponsive child. This covers successful, signed-out, rejected, timed-out, and pipe-setup failure paths. Thanks to @derekhe for #7.

This release also updates development dependencies, refreshes macOS runners, and runs the mock-subprocess lifecycle tests on Windows and macOS. Follow-up on the reported Windows LSASS/RPC crash remains in #6.

Packages remain unsigned. SHA-256 files are included with the downloads.
