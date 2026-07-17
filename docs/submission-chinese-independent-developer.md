# 中国独立开发者项目列表投稿文案

建议放入项目列表中与开发工具、效率工具最接近的现有分类，并按作者名称的既有排序方式插入。

## README 条目

```markdown
#### Silvren - [Github](https://github.com/Silvren)
* :white_check_mark: [Codex Quota Dot](https://github.com/Silvren/codex-quota-dot)：Codex 桌面额度悬浮球，自动识别短周期和周额度窗口，支持 Windows/macOS，纯本地读取 Codex app-server 数据，不接触认证文件 - [下载](https://github.com/Silvren/codex-quota-dot/releases/latest)
```

## PR 标题

```text
添加 Codex Quota Dot
```

## PR 说明

```markdown
新增 Codex Quota Dot：一个轻量、隐私优先的 Codex 桌面额度悬浮球。它通过本机 Codex app-server 获取当前可用的短周期或周额度窗口，不读取或复制 `auth.json`、Token、Cookie 和对话记录；短周期窗口缺失时会自动降级显示周额度。

项目采用 MIT 协议，提供 Windows x64、macOS Apple Silicon 和 macOS Intel 构建。
```

## 发布期说明

Codex 的额度窗口可能因套餐、工作区、活动和灰度发布而不同。不要在投稿文案中声称 OpenAI 已永久或全局取消 5 小时额度；项目 README 和 v0.2.0 Release Notes 已使用更稳妥的动态窗口表述。
