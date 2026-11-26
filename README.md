# Awesome Agent LLM Wiki

一个由 LLM 按 [Karpathy 的 LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 增量维护的知识库，汇集头部实验室、工业界、学术界和 neolab 关于 agent 的研究和认知。素材分四类：论文、技术或产品 blog、技术视频、podcast，用概念页在跨素材之间建立连接。

规范和录入流程见 [`CLAUDE.md`](CLAUDE.md)（`AGENTS.md` 是同一份内容的副本）。

- `wiki/` — LLM 维护的知识库正文，`sources/` — 原始资料（只增不改）。
- `site/` — Astro + Starlight 站点工程，部署到 GitHub Pages。
- `scripts/` — 抓取和 lint 脚本（Python，`uv run`）。

站点地址：<https://aleda.github.io/awesome-agent-llm-wiki/>

## 录入命令

（Task 15–17 完成后回填：论文/blog/视频/podcast 的抓取与入库命令。）

## 本地开发

```bash
cd site
npm ci
npm test              # vitest 单元测试
npm run e2e           # Playwright e2e（迷你仓库 fixture）
npm run build         # 构建真实内容站点（含预算检查），输出到 site/dist/
npx lhci autorun      # Lighthouse 性能门槛（移动端 Performance ≥ 95）
```
