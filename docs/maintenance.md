# Maintenance

Codex Quota Dot remains maintained as a small desktop companion. Its purpose is to keep quota visible while you work in a terminal, editor, or another window. If Codex's built-in usage display is enough for you, there is no need to install it.

The CLI also supports an in-terminal usage display through [`/statusline`](https://learn.chatgpt.com/docs/developer-commands?surface=cli). This widget's role is visibility on the desktop across windows. Its arcs follow reported quota periods rather than assuming a fixed set for Plus or Pro.

Updates focus on:

- compatibility with the documented Codex app-server account methods;
- reliable refresh and subprocess cleanup;
- correct quota, reset-time, balance, and cached-state display;
- platform bugs and actionable reports.

There is no fixed release schedule. New features should solve a concrete desktop-widget need and fit the small interface. Large architectural changes should start with an issue, as described in [Contributing](../CONTRIBUTING.md).

## Current reports

- [#6: Windows LSASS/RPC crash](https://github.com/Silvren/codex-quota-dot/issues/6): [#7](https://github.com/Silvren/codex-quota-dot/pull/7) changes immediate termination to graceful shutdown with a bounded fallback. The crash report remains open for follow-up across Codex and Windows versions.
- [#3: antivirus detection](https://github.com/Silvren/codex-quota-dot/issues/3): verification guidance and a dedicated report template are available in [Windows download safety](windows-download-safety.md). Further investigation needs the exact detection name and asset SHA-256.

维护重点是兼容性、稳定性和有依据的问题反馈。小工具可以按需更新，不需要靠频繁加功能证明它还活着。
