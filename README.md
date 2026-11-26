# Awesome Agent LLM Wiki

一个由 LLM 按 [Karpathy 的 LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 增量维护的知识库，汇集头部实验室、工业界、学术界和 neolab 关于 agent 的研究和认知。素材分四类：论文、技术或产品 blog、技术视频、podcast，用概念页在跨素材之间建立连接。

规范和录入流程见 [`CLAUDE.md`](CLAUDE.md)（`AGENTS.md` 是同一份内容的副本）。

- `wiki/` — LLM 维护的知识库正文，`sources/` — 原始资料（只增不改）。
- `site/` — Astro + Starlight 站点工程，部署到 GitHub Pages。
- `scripts/` — 抓取和 lint 脚本（Python，`uv run`）。

站点地址：<https://aleda.github.io/awesome-agent-llm-wiki/>
