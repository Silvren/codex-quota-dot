# Codex Quota Dot v0.2.4

![Codex Quota Dot v0.2.4](https://raw.githubusercontent.com/Silvren/codex-quota-dot/v0.2.4/assets/codex-quota-dot-ui.jpg)

不用为了看余额再打开设置了。这次把 credits 余额放进展开卡片，和剩余额度、重置时间一起看。

- 新增额度余额，随配额一起刷新；单位是 **credits 点数，不是美元金额**。
- 零余额、未返回数据、不限额和缓存数据分别显示，不把缺失数据当成零。
- 卡片仍为 320 × 256，小球仍为 56 px，没有增加依赖。
- 保留 Plus / Pro 等账号按实际周期展示、中英切换、拖动、点击展开和可取消置顶。

Adds credit balance to the compact card, using the existing read-only Codex app-server response. Balances are credits, not USD; no currency conversion or payment integration is included.

此前已完成 53 项前端单元测试、15 项 Rust 单元测试和真实账号只读余额链路验证。本次发布不再查询账号余额；构建流程由 GitHub Actions 执行。

安装包未签名。请核对附件中的 SHA-256 校验文件。
