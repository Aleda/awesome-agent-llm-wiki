---
title: 操作日志
type: raw
---

追加式操作日志，每次创建或更新 wiki 页面后在文件末尾加一行，不修改已有行。

格式：`YYYY-MM-DD 操作 · 页面`

- `操作` 是简短动词短语，如「新建」「更新」「合并」「录入素材」。
- `页面` 是相对 `wiki/` 的路径，如 `papers/2611-you-dont-need-long-context.md`；一次操作涉及多个页面时用顿号分隔列出。

示例：

```
2026-11-26 新建 · papers/2611-you-dont-need-long-context.md
```

2026-11-26 新建 · topics/agent.md、topics/context.md、topics/memory.md、topics/rsi.md、topics/continual-learning.md
2026-11-26 更新 · glossary.md、index.md
