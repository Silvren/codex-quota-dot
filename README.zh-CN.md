# Codex Quota Dot

**看一眼小球，就知道 Codex 还能用多少。**

一个给 **Codex CLI / Codex Desktop** 用户做的轻量配额悬浮窗，支持 **Windows 和 macOS**。不用反复打开用量页面，也不用把终端切走。

[English](README.md) · [下载最新版](https://github.com/Silvren/codex-quota-dot/releases/latest) · [反馈问题](https://github.com/Silvren/codex-quota-dot/issues/new/choose)

> 独立开源项目，与 OpenAI 无隶属关系，也未获其背书。

![Codex Quota Dot：额度卡片和悬浮球的三种状态](assets/codex-quota-dot-ui.jpg)

## 它解决什么问题？

写代码时，想知道剩余额度，却不想再开一个页面。

- **56 px 小球**：常驻桌面，拖动换位置，点击才展开；鼠标经过不会突然弹开。
- **320 × 256 卡片**：查看剩余额度、重置倒计时和重置机会到期时间。
- **按实际周期显示**：Plus、Pro 等套餐统一读取账号实际返回的数据。只有周额度，就显示周额度；不把缺少五小时窗口当成报错。
- **克制的颜色反馈**：蓝色表示充足，琥珀色提醒留意，珊瑚色表示紧张；没有数据时保持中性。
- **中英切换、可取消置顶**：收起用 Esc，不强迫你一直留着大卡片。

尺寸为逻辑像素，会随系统显示缩放调整。“消耗中”由连续两次额度变化推断，不代表正在运行某个具体任务。

## 下载和使用

从 [GitHub Releases 下载 v0.2.3 或更新版本](https://github.com/Silvren/codex-quota-dot/releases/latest)：

| 你的系统 | 选择的文件 |
| --- | --- |
| Windows x64 | `windows-x64-setup.exe` 安装包，或 `windows-x64-portable.zip` 便携版 |
| Mac Apple Silicon | `macos-arm64.zip` |
| Mac Intel | `macos-x64.zip` |

1. 安装 Codex Desktop 或 Codex CLI，并在 Codex 中登录。
2. 安装或解压适合系统的下载包，启动 Codex Quota Dot。
3. 拖动小球移动，点击展开，按 Esc 收起。卡片右下角可以手动刷新。

**只用 Codex CLI 也可以。** 请确保 `codex` 在 PATH 中，或在启动前把 `CODEX_BINARY` 设置为它的可执行文件路径。同时安装 Desktop 和 CLI 时，默认优先使用 Desktop 自带的 Codex；设置 `CODEX_BINARY` 可以明确指定。

当前安装包未签名。请只从本仓库 Releases 下载，并核对旁边的 SHA-256 文件；不要为运行软件关闭安全防护。参见 [Windows 下载验证说明](docs/windows-download-safety.md)。

## 额度为什么有时不显示？

软件展示的是 Codex 返回的数据，而不是自己估算套餐额度：

- 返回多个有效周期：主区域显示较短周期，底部显示另一个。
- 只返回周额度：小球标注“周”，卡片显示周剩余和具体重置时间。
- 未提供额度：显示“暂无额度数据”，不编造 0%、100% 或“无限额度”。
- 刷新失败：已保存的数据明确标注为旧数据。

套餐策略、账号和 Codex 版本都可能影响返回内容。这个工具不是 API 账单或 token 成本统计器，也不提供额度绕过功能。

## 轻量与隐私

基于 Tauri、Rust 和 React，不捆绑浏览器，不引入移动端、同步服务或额外服务器。

- 通过已安装的 `codex app-server` 读取账号配额。
- 不读取或复制 `auth.json`、令牌、Cookie、聊天内容或项目文件。
- 登录由 Codex 自己处理，小球不要求你提供密码或 API Key。
- 无广告、遥测和统计上报；本地仅保存设置、位置和标准化额度快照。

Codex 自身可能联网查询额度，因此这不是完全离线工具。更多细节见 [隐私设计](docs/privacy.md)。

## 反馈和参与

遇到问题请 [提交 Issue](https://github.com/Silvren/codex-quota-dot/issues/new/choose)，附上系统、软件版本和现象即可。不要上传登录令牌或未经检查的账号响应。

想改代码？参见 [开发步骤](README.md#development) 和 [贡献指南](CONTRIBUTING.md)。每个平台的显示缩放和多显示器行为可能不同，欢迎反馈具体使用体验。

[MIT License](LICENSE) · [第三方许可](THIRD_PARTY_NOTICES.md)
