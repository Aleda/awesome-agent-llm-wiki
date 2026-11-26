# Awesome Agent LLM Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建一个 LLM 维护的 agent 研究知识库：四类素材模板、主题/概念/素材三层、可分档缩放的水滴图谱首页、带两张卡片和悬停批注的内容页，部署到 GitHub Pages，并录入 v1 样例。

**Architecture:** 内容在仓库根目录的 `wiki/`、`sources/`。`site/scripts/prepare.ts` 在构建前读取全部内容，做 schema 和关系校验，生成 `.generated/index.json`（供 remark 插件和组件使用）、图谱数据和悬停预览 JSON，并把内容复制进 Starlight 的 `src/content/docs/`。之后 `astro build` 出静态站。Python 脚本负责抓取和 lint。

**Tech Stack:** Astro 7.4.x、@astrojs/starlight 0.43.x、`astro/zod`、gray-matter、d3-force、d3-quadtree、unified/remark、vitest 5、happy-dom、@playwright/test、@lhci/cli、tsx；Python ≥3.10 + uv（PEP 723 内联依赖）、yt-dlp、faster-whisper、trafilatura、pypdf、pytest。

**Spec:** `docs/superpowers/specs/2026-11-26-agent-llm-wiki-design.md`

## Global Constraints

- base path `/awesome-agent-llm-wiki/`，site `https://aleda.github.io`；纯静态，GitHub Pages。
- `wiki/` 内部链接一律相对路径 Markdown 链接，不用 `[[双链]]`；在 GitHub 上可读。
- `sources/` 只增不改；`anchors.md` 只允许追加。
- wiki 文件名只允许 `^[a-z0-9][a-z0-9.-]*\.md$`（Starlight 会把 slug 转小写，大写或中文文件名会让链接失效）。
- `summary` ≤ 60 字；`## 新认知` 3–10 条，每条带锚点。
- `rel` 只能是：`proposes` `extends` `supports` `challenges` `applies` `explains` `responds` `part-of` `alternative-to`（`by` 单独成字段）。
- 时间戳一律 `HH:MM:SS`；论文锚点 `§3.2` `Fig. 4` `Tab. 2`；blog 锚点 `§2` `§2¶3`。
- 预算：内容页本库新增 JS ≤ 10 KB gzip；图谱页 JS ≤ 80 KB gzip；2,000 节点图谱数据 ≤ 150 KB gzip；移动端 Lighthouse Performance ≥ 95；图谱首屏可交互 ≤ 1.5 s、平移缩放 60 fps（手测）。
- 悬停 150 ms 后才请求预览；锚点原文片段截前 200 字；左卡"相关"最多 6 条，其余折叠。
- 自动生成段落只在构建时注入，不写回 `.md`。
- 论文和 blog 全文只放 `.cache/`（gitignore）。
- 所有面向用户的文案用中文；专有名词保留英文。

## Review Focus

- 带 `#fragment` 的内部链接、外链、图片链接、指向 `sources/` 的链接：改写时片段保留，外链和图片不动（Task 6 测试）。
- 引用了信源里不存在的锚点：站点渲染成纯文本，不报错、不出死链；lint 负责报错（Task 6 测试）。
- 没有任何关系或反链的孤立概念、空主题：布局坐标有限（非 NaN），卡片显示空状态（Task 7、Task 10 测试）。
- 悬停后 150 ms 内移开、预览 JSON 404、同一链接快速反复悬停：不弹卡、不抛错、只请求一次（Task 9 测试）。
- 打开带未知节点的分享链接（`#node=不存在&z=2`）：图谱回到 L0 全局视图，不报错（Task 12 测试）。

---

## File Structure

```
.gitignore  README.md  CLAUDE.md  AGENTS.md
.github/workflows/pages.yml
wiki/{index.md,log.md,glossary.md,topics/,concepts/,papers/,blogs/,videos/,podcasts/,entities/}
sources/{papers/,blogs/,videos/,podcasts/,seen.txt,skipped.txt}
tests/fixtures/mini-repo/          # TS 和 Python 测试共用的迷你仓库
scripts/
  lint.py  fetch_paper.py  fetch_blog.py  fetch_video.py  fetch_podcast.py
  lib/transcribe.py  lib/anchors.py
  tests/test_*.py
site/
  package.json  astro.config.mjs  tsconfig.json  vitest.config.ts  playwright.config.ts  lighthouserc.json
  data/graph-positions.json        # 提交入库，保持布局稳定
  scripts/prepare.ts  scripts/check-budgets.ts
  src/content.config.ts
  src/lib/{schema.ts,content-index.ts,anchors.ts,remark-wiki.ts,rehype-transcript.ts,page-info.ts,auto-sections.ts,labels.ts,routes.ts}
  src/graph/{build.ts,camera.ts,lod.ts,droplet.ts,render.ts,interaction.ts,search.ts,hash.ts}
  src/scripts/hovercard.ts
  src/components/{PageTitle.astro,MetaCard.astro,SourceCard.astro,HoverCard.astro,GraphApp.astro}
  src/styles/tokens.css
  src/pages/index.astro
  tests/*.test.ts  e2e/*.spec.ts
```

## Phase 1 · 骨架与数据层

### Task 1: 仓库骨架与本库规范

**Files:**
- Create: `.gitignore`、`README.md`、`CLAUDE.md`、`AGENTS.md`、`wiki/index.md`、`wiki/log.md`、`wiki/glossary.md`、`wiki/{topics,concepts,papers,blogs,videos,podcasts,entities}/.gitkeep`、`sources/seen.txt`、`sources/skipped.txt`、`sources/{papers,blogs,videos,podcasts}/.gitkeep`
- Add: `docs/superpowers/specs/`（设计文档和 assets）、本计划

**Interfaces:**
- Produces: 目录约定（spec §6）；术语表格式：每条 `## <术语>` 标题加一两句正文，锚点 slug 规则见 Task 3 的 `termSlug`。

- [ ] **Step 1: 写 `.gitignore`**：`.cache/`、`node_modules/`、`site/dist/`、`site/.generated/`、`site/src/content/docs/`、`site/public/data/`、`*.m4a`、`*.mp3`、`*.wav`、`*.webm`、`.lighthouseci/`。
- [ ] **Step 2: 写 `CLAUDE.md`**：本库的操作手册，内容取自 spec §5（三层、关系表、概念建页与去重规则）、§6（目录与 frontmatter 字段，附完整示例）、§7（卡片字段、各类型正文模板、锚点格式、「来源：」行规则、术语表写法）、§10（录入流程六步、lint 检查项、两级核验、与 ai-kol-wiki 互不共用转录稿）。写作约定沿用 ai-kol-wiki CLAUDE.md 的「写作约定」一节，把"视频页 Highlights"改为"所有素材页的 `## 新认知`"。脚本命令在 Task 15–17 完成后回填。
- [ ] **Step 3: `cp CLAUDE.md AGENTS.md`**；`wiki/index.md` 写出主题、概念、论文、blog、视频、播客、实体七个空小节；`wiki/log.md` 写表头说明（每行 `YYYY-MM-DD 操作 · 页面`）。
- [ ] **Step 4: 验证**：`diff CLAUDE.md AGENTS.md` 无输出；`git status` 不出现 `.cache` 或 `node_modules`。
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold wiki layout, schema docs, design spec and plan"
```

### Task 2: 站点工程与 frontmatter schema

**Files:**
- Create: `site/package.json`、`site/tsconfig.json`、`site/vitest.config.ts`、`site/src/lib/schema.ts`
- Test: `site/tests/schema.test.ts`

**Interfaces:**
- Produces:
  - `REL = ['proposes','extends','supports','challenges','applies','explains','responds','part-of','alternative-to'] as const`
  - `PAGE_TYPES = ['topic','concept','paper','blog','video','podcast','entity','raw'] as const`；`type Rel = typeof REL[number]`、`type PageType = typeof PAGE_TYPES[number]`
  - `pageSchema`：按 `type` 区分的 zod discriminated union，导出 `type PageFrontmatter = z.infer<typeof pageSchema>`
  - `relationSchema`：`{ concept | source | topic: string, rel: Rel, note?: string }`，恰好有一个目标键
  - `bySchema`：`{ entity?: string, name?: string, role: 'org'|'author'|'host'|'guest'|'speaker', bio?: string }`，`entity` 和 `name` 至少一个

- [ ] **Step 1: 建工程**：`site/package.json` 依赖 `astro@^7.4.13`、`@astrojs/starlight@^0.43.1`、`gray-matter`、`d3-force`、`d3-quadtree`、`unified`、`remark-parse`、`unist-util-visit`、`hast-util-to-string`；dev 依赖 `vitest@^5`、`happy-dom`、`tsx`、`@playwright/test`、`@lhci/cli`、`@types/d3-force`、`@types/d3-quadtree`。scripts：`prepare-content: tsx scripts/prepare.ts`、`build: npm run prepare-content && astro build`（Task 14 再接上预算检查）、`dev: npm run prepare-content && astro dev`、`test: vitest run`、`e2e: playwright test`。用 `npm install` 生成 lockfile。
- [ ] **Step 2: 写失败测试** `site/tests/schema.test.ts`：

```ts
const paper = { title:'T', type:'paper', summary:'一句话', topics:['context'], aliases:[], added:'2026-11-26',
  date:'2026-11-03', url:'https://arxiv.org/abs/2611.05306', source_dir:'sources/papers/2611.05306', venue:'arXiv',
  by:[{entity:'nvidia', role:'org'}], relations:[{concept:'context-compaction', rel:'proposes'}] };
test('valid paper passes', () => expect(pageSchema.safeParse(paper).success).toBe(true));
test('summary over 60 chars fails', () => expect(pageSchema.safeParse({...paper, summary:'字'.repeat(61)}).success).toBe(false));
test('unknown rel fails', () => expect(pageSchema.safeParse({...paper, relations:[{concept:'x', rel:'likes'}]}).success).toBe(false));
test('relation with two targets fails', () => expect(pageSchema.safeParse({...paper, relations:[{concept:'x', source:'y', rel:'extends'}]}).success).toBe(false));
test('source page needs at least one relation', () => expect(pageSchema.safeParse({...paper, relations:[]}).success).toBe(false));
test('video requires duration', () => expect(pageSchema.safeParse({...paper, type:'video', venue:'Bilibili'}).success).toBe(false));
test('podcast requires a host and a guest in by', () => expect(pageSchema.safeParse({...paper, type:'podcast', duration:41, by:[{name:'Koji', role:'host'}]}).success).toBe(false));
test('concept status defaults to emerging', () => expect(pageSchema.parse({title:'C', type:'concept', summary:'s', topics:['context'], added:'2026-11-26', relations:[{topic:'context', rel:'part-of'}]}).status).toBe('emerging'));
test('topic root flag and order', () => expect(pageSchema.parse({title:'Agent', type:'topic', summary:'s', added:'2026-11-26', root:true, order:0}).root).toBe(true));
test('raw page needs only title', () => expect(pageSchema.safeParse({title:'transcript', type:'raw'}).success).toBe(true));
```

- [ ] **Step 3: 跑测试确认失败**：`cd site && npx vitest run tests/schema.test.ts`，预期 FAIL（`pageSchema` 未定义）。
- [ ] **Step 4: 实现 `site/src/lib/schema.ts`**：用 `import { z } from 'astro/zod'`。字段取自 spec §6.1–§6.2：公共字段 `title`、`type`、`summary`（`max(60)`）、`topics`（默认 `[]`）、`aliases`（默认 `[]`）、`added`；素材类型另有 `date`、`url`、`source_dir`、`venue`、`duration`（video、podcast 必填，单位分钟）、`show`（podcast 必填，节目名；`venue` 是平台）、`by`、`relations`（`min(1)`）；论文可选 `code`、`pages`；concept 有 `status`（默认 `emerging`）、`redirect_to?`；topic 有 `root?`、`order?`；raw 只要 `title`，其余字段 `passthrough`。
- [ ] **Step 5: 跑测试确认通过**：同上命令，预期 10 passed。
- [ ] **Step 6: Commit**：`git add site && git commit -m "feat(site): scaffold Astro project and frontmatter schema"`

### Task 3: 迷你测试仓库与内容索引

**Files:**
- Create: `tests/fixtures/mini-repo/`（见 Step 1）、`site/src/lib/content-index.ts`、`site/src/lib/routes.ts`
- Test: `site/tests/content-index.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `pageSchema`、`REL`
- Produces:
  - `type PageId = string`，等于去掉 `.md` 的仓库相对路径，如 `wiki/concepts/context-compaction`
  - `interface Page { id: PageId; path: string; fm: PageFrontmatter; body: string; sections: Record<string,string> }`（`sections` 以二级标题文字为键）
  - `interface Edge { from: PageId; to: PageId; rel: Rel; note?: string }`
  - `interface RepoIndex { pages: Map<PageId, Page>; edges: Edge[]; backlinks: Map<PageId, Edge[]>; redirects: Map<PageId, PageId> }`
  - `loadRepo(root: string): Promise<RepoIndex>`：校验失败时抛 `ContentError`，`errors: string[]` 汇总**所有**问题（文件名、schema、关系目标或 `by.entity` 指向的页面不存在），不在第一处就停
  - `resolveTarget(rel: Relation): PageId`：`concept:x` → `wiki/concepts/x`，`topic:x` → `wiki/topics/x`，`source:papers/x` → `wiki/papers/x`；`entity:x` → `wiki/entities/x`
  - `resolveLink(fromPath: string, href: string): { id: PageId; hash: string } | null`：相对 `.md` 链接转 PageId，外链返回 null
  - `termSlug(term: string): string`：小写，非 `[a-z0-9]` 连续字符换成单个 `-`，去首尾 `-`
  - `routes.ts`：`BASE = '/awesome-agent-llm-wiki'`；`toRoute(id: PageId, hash = ''): string` → `${BASE}/${id}/${hash}`

- [ ] **Step 1: 建迷你仓库**（只放测试需要的最少内容）：
  - `wiki/topics/agent.md`（`root: true`，`order: 0`）、`wiki/topics/context.md`（`order: 1`）、`wiki/topics/memory.md`（空主题，没有任何概念）
  - `wiki/concepts/context-compaction.md`（`part-of` → context）、`wiki/concepts/isolated-idea.md`（`part-of` → context，没有素材指向它）、`wiki/concepts/old-name.md`（`redirect_to: context-compaction`）
  - `wiki/papers/202611-sample-paper.md`：`source_dir: sources/papers/2611.00001`，`by: [{ entity: demo-org, role: org }]`，`relations` 含 `proposes` → context-compaction 和 `challenges` → old-name；`## 新认知` 两条，带锚点 `（§3.2）`、`（Fig. 4）`；正文有链接 `[术语](../glossary.md#browsecomp-plus)` 和 `[概念](../concepts/context-compaction.md#定义)`
  - `wiki/videos/20261101-demo-explainer.md`：`duration: 13`，`source_dir: sources/videos/demo/20261101-abc`，`relations: [{ source: papers/202611-sample-paper, rel: explains }]`；`## 新认知` 一条带 `（[00:01:02]）`；`## 时间线` 里一条带不存在的 `（[09:09:09]）`
  - `wiki/glossary.md`：`## BrowseComp-Plus`、`## GRPO` 各一段
  - `wiki/entities/demo-org.md`：一句话介绍
  - `sources/papers/2611.00001/anchors.md`：`## §3.2 Method`、`- Fig. 4 — Accuracy vs. context length`、`- §3.2: "we compact every 8 turns"`
  - `sources/videos/demo/20261101-abc/transcript.md`：frontmatter 加 `[00:00:00]`、`[00:01:02]` 两个锚点段落
  - 另建 `tests/fixtures/broken-repo/`：一个关系指向不存在的概念、一个文件名含大写 `Bad-Name.md`、一个 summary 超长
- [ ] **Step 2: 写失败测试**：

```ts
const idx = await loadRepo(MINI);
test('page ids are repo-relative paths', () => expect(idx.pages.has('wiki/concepts/context-compaction')).toBe(true));
test('redirected relation resolves to new target', () =>
  expect(idx.edges).toContainEqual(expect.objectContaining({from:'wiki/papers/202611-sample-paper', to:'wiki/concepts/context-compaction', rel:'challenges'})));
test('redirect pages are not in pages', () => expect(idx.redirects.get('wiki/concepts/old-name')).toBe('wiki/concepts/context-compaction'));
test('backlinks are collected', () => expect(idx.backlinks.get('wiki/papers/202611-sample-paper')!.map(e => e.rel)).toEqual(['explains']));
test('sections keyed by h2', () => expect(idx.pages.get('wiki/papers/202611-sample-paper')!.sections['新认知']).toMatch(/§3\.2/));
test('broken repo reports all errors at once', async () => {
  const err = await loadRepo(BROKEN).catch(e => e);
  expect(err).toBeInstanceOf(ContentError); expect(err.errors).toHaveLength(3); });
test('resolveLink keeps hash', () => expect(resolveLink('wiki/papers/a.md', '../concepts/x.md#定义')).toEqual({id:'wiki/concepts/x', hash:'#定义'}));
test('resolveLink ignores external and images', () => {
  expect(resolveLink('wiki/papers/a.md', 'https://arxiv.org/abs/1')).toBeNull();
  expect(resolveLink('wiki/papers/a.md', '../assets/fig.png')).toBeNull(); });
test('termSlug', () => { expect(termSlug('BrowseComp-Plus')).toBe('browsecomp-plus'); expect(termSlug('Claude Code')).toBe('claude-code'); });
test('toRoute', () => expect(toRoute('wiki/concepts/x', '#a')).toBe('/awesome-agent-llm-wiki/wiki/concepts/x/#a'));
```

- [ ] **Step 3: 跑测试确认失败**：`npx vitest run tests/content-index.test.ts`，预期 FAIL。
- [ ] **Step 4: 实现 `content-index.ts` 和 `routes.ts`**：用 gray-matter 解析；`raw` 类型不参与关系校验；`redirect_to` 页从 `pages` 移出，放进 `redirects`。
- [ ] **Step 5: 跑测试确认通过**，预期全部 PASS。
- [ ] **Step 6: Commit**：`git commit -am "feat(site): content index with relation, redirect and link resolution"`（新文件先 `git add`）

### Task 4: 锚点解析

**Files:**
- Create: `site/src/lib/anchors.ts`
- Test: `site/tests/anchors.test.ts`

**Interfaces:**
- Produces:
  - `parseTranscriptAnchors(md: string): Map<string, string>`：键为 `HH:MM:SS`，值为该锚点到下一锚点之间的文字，截前 200 字
  - `parseAnchorsMd(md: string): Map<string, string>`：键为 `§3.2`、`Fig. 4`、`Tab. 2`、`§2¶3`；值为标题、图表说明或引用短句。格式：`## §<编号> <标题>`、`- Fig. <n> — <说明>`、`- Tab. <n> — <说明>`、`- §<编号>[¶<n>]: "<短句>"`；同一键既有标题又有短句时取短句
  - `interface Citation { key: string; start: number; end: number }`
  - `findCitations(text: string): Citation[]`：识别 `[HH:MM:SS]`、`§<编号>[¶<n>]`、`Fig. <n>`、`Tab. <n>`，只在全角括号 `（…）` 内识别

- [ ] **Step 1: 写失败测试**：

```ts
test('transcript anchors truncate to 200 chars', () => {
  const m = parseTranscriptAnchors('[00:00:00] ' + '字'.repeat(300) + '\n[00:01:02] 第二段');
  expect(m.get('00:00:00')!.length).toBe(200); expect(m.get('00:01:02')).toBe('第二段'); });
test('anchors.md keys', () => {
  const m = parseAnchorsMd('## §3.2 Method\n- Fig. 4 — Accuracy\n- Tab. 2 — Cost\n- §3.2: "we compact every 8 turns"\n- §2¶3: "q"');
  expect([...m.keys()].sort()).toEqual(['Fig. 4','Tab. 2','§2¶3','§3.2']);
  expect(m.get('§3.2')).toBe('we compact every 8 turns'); });
test('citations only inside full-width parens', () => {
  expect(findCitations('见 §3.2 和（§3.2、Fig. 4）以及（[00:12:03]–[00:14:05]）').map(c => c.key))
    .toEqual(['§3.2','Fig. 4','00:12:03','00:14:05']); });
```

- [ ] **Step 2: 跑测试确认失败**：`npx vitest run tests/anchors.test.ts`
- [ ] **Step 3: 实现 `anchors.ts`**
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: Commit**：`git add site/src/lib/anchors.ts site/tests/anchors.test.ts && git commit -m "feat(site): anchor parsing for transcripts, papers and blogs"`

### Task 5: 构建前准备脚本 prepare

**Files:**
- Create: `site/scripts/prepare.ts`
- Test: `site/tests/prepare.test.ts`

**Interfaces:**
- Consumes: `loadRepo`、`toRoute`、`termSlug`（Task 3），`parseTranscriptAnchors`、`parseAnchorsMd`（Task 4）
- Produces（下游任务只读这些文件，不再自己扫仓库）：
  - `prepare(opts: { root: string; siteDir: string }): Promise<void>`；CLI 入口用 `root = process.env.CONTENT_ROOT ?? '..'`、`siteDir = '.'`；`ContentError` 时逐行打印 `errors` 并以退出码 1 结束
  - `<siteDir>/src/content/docs/wiki/**`：wiki 原样复制
  - `<siteDir>/src/content/docs/sources/**`：只复制 `transcript.md` 和 `anchors.md`，frontmatter 改写为 `{ title, type: 'raw', pagefind: false, raw: <原 frontmatter> }`
  - `<siteDir>/.generated/index.json`：类型为 `GeneratedIndex`（定义并导出在 `content-index.ts`），结构 `{ pages: Record<PageId, PageInfo>, edges: Edge[], backlinks: Record<PageId, Edge[]>, redirects: Record<PageId, PageId> }`，其中 `PageInfo = { id, type, title, summary, topics, date?, venue?, duration?, url?, by, sourceKey?, insights: string[], status?, root?, order? }`；`insights` 是 `## 新认知` 的前 3 条，去掉 Markdown 标记和锚点括号
  - `<siteDir>/public/data/previews/<PageId>.json`：`{ id, type, title, summary, topics, insight?: string }`
  - `<siteDir>/public/data/anchors/<source_dir>.json`：`Record<key, { text: string; href: string }>`；转录稿的 `href` 为 `toRoute(<转录稿 id>, '#t-HHMMSS')`，论文和 blog 的 `href` 为该素材页的 `url`
  - `<siteDir>/public/data/glossary.json`：`Record<termSlug, { term: string; text: string }>`
  - `export function stripInsight(md: string): string`（供测试）

- [ ] **Step 1: 写失败测试**（对迷你仓库跑 `prepare`，输出到临时目录）：

```ts
await prepare({ root: MINI, siteDir: tmp });
const index = JSON.parse(read(tmp, '.generated/index.json'));
test('transcripts become raw pages excluded from search', () =>
  expect(matter(read(tmp, 'src/content/docs/sources/videos/demo/20261101-abc/transcript.md')).data).toMatchObject({type:'raw', pagefind:false}));
test('insights are stripped', () => expect(index.pages['wiki/papers/202611-sample-paper'].insights[0]).not.toMatch(/[（*\[]/));
test('preview json written', () => expect(JSON.parse(read(tmp, 'public/data/previews/wiki/concepts/context-compaction.json')).type).toBe('concept'));
test('transcript anchor href points to transcript page', () =>
  expect(JSON.parse(read(tmp, 'public/data/anchors/sources/videos/demo/20261101-abc.json'))['00:01:02'].href)
    .toBe('/awesome-agent-llm-wiki/sources/videos/demo/20261101-abc/transcript/#t-000102'));
test('glossary keyed by slug', () => expect(JSON.parse(read(tmp, 'public/data/glossary.json'))['browsecomp-plus'].term).toBe('BrowseComp-Plus'));
test('broken repo exits with all errors', async () => expect(prepare({ root: BROKEN, siteDir: tmp2 })).rejects.toThrow(ContentError));
```

- [ ] **Step 2: 跑测试确认失败**：`npx vitest run tests/prepare.test.ts`
- [ ] **Step 3: 实现 `prepare.ts`**：每次运行先清空 `src/content/docs/`、`public/data/`、`.generated/` 再写，保证删掉的页面不会残留。
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: Commit**：`git add site && git commit -m "feat(site): prepare step generating index, previews, anchors and glossary data"`

## Phase 2 · 内容页

### Task 6: Starlight 配置、链接改写与锚点链接

**Files:**
- Create: `site/astro.config.mjs`、`site/src/content.config.ts`、`site/src/lib/remark-wiki.ts`、`site/src/lib/rehype-transcript.ts`、`site/src/styles/tokens.css`
- Test: `site/tests/remark-wiki.test.ts`

**Interfaces:**
- Consumes: `.generated/index.json` 和 `public/data/anchors/*.json`（Task 5）；`resolveLink`、`toRoute`、`termSlug`（Task 3）；`findCitations`（Task 4）
- Produces:
  - `remarkWiki(opts: { indexPath: string; anchorsDir: string }): Plugin`，处理结果：
    - 内部链接：`href = toRoute(id, hash)`（指向 redirect 页的改指新页），加 `data-preview="${BASE}/data/previews/${id}.json"`
    - 术语链接（目标为 `wiki/glossary`）：`data-preview="${BASE}/data/glossary.json"`，`data-term=<slug>`
    - 目标不存在的内部链接：降为纯文本
    - 锚点：`<a class="cite" href=<anchors json 里的 href> data-preview=<anchors json 路径> data-key=<key>>`；key 不在该信源的锚点表里时保持纯文本
    - 当前信源的判定：默认取页面 `source_dir`；以 `来源：` 开头的段落把信源切到该段第一个链接所指页面的 `source_dir`，一直管到下一个 `来源：` 段落；同一个全角括号里同时有链接和锚点时（写法 `（[视频页](../videos/x.md) [00:01:02]）`），用该链接的信源
  - `rehypeTranscript(): Plugin`：`sources/**/transcript` 页里以 `[HH:MM:SS]` 开头的段落加 `id="t-HHMMSS"`
  - CSS 变量（`tokens.css`，亮色和深色各一套）：`--c-topic` `--c-concept` `--c-paper` `--c-blog` `--c-video` `--c-podcast` `--c-entity`，以及 `--card-bg` `--card-border` `--card-shadow`。图谱、卡片、悬停卡共用

- [ ] **Step 1: 写失败测试**（`unified().use(remarkParse).use(remarkWiki, opts).use(remarkRehype).use(rehypeStringify)`，`file.path` 设为文档内路径，opts 指向 Task 5 测试生成的临时目录）：

```ts
test('internal link rewritten with hash and preview', async () => {
  const html = await md('[c](../concepts/context-compaction.md#定义)', 'wiki/papers/202611-sample-paper.md');
  expect(html).toContain('href="/awesome-agent-llm-wiki/wiki/concepts/context-compaction/#定义"');
  expect(html).toContain('data-preview="/awesome-agent-llm-wiki/data/previews/wiki/concepts/context-compaction.json"'); });
test('external link and image untouched', async () => {
  const html = await md('[a](https://arxiv.org/abs/1) ![f](../assets/f.png)', 'wiki/papers/202611-sample-paper.md');
  expect(html).toContain('href="https://arxiv.org/abs/1"'); expect(html).toContain('src="../assets/f.png"'); });
test('link to redirected concept goes to new page', async () =>
  expect(await md('[o](../concepts/old-name.md)', 'wiki/papers/202611-sample-paper.md')).toContain('/wiki/concepts/context-compaction/'));
test('missing internal link becomes text', async () =>
  expect(await md('[x](../concepts/nope.md)', 'wiki/papers/202611-sample-paper.md')).not.toContain('<a'));
test('glossary link gets term preview', async () =>
  expect(await md('[B](../glossary.md#browsecomp-plus)', 'wiki/papers/202611-sample-paper.md')).toContain('data-term="browsecomp-plus"'));
test('timestamp cites own transcript', async () =>
  expect(await md('一句话（[00:01:02]）', 'wiki/videos/20261101-demo-explainer.md')).toContain('#t-000102'));
test('unknown anchor stays text', async () =>
  expect(await md('一句话（[09:09:09]）', 'wiki/videos/20261101-demo-explainer.md')).not.toContain('class="cite"'));
test('来源 line switches source', async () =>
  expect(await md('来源：[视频](../videos/20261101-demo-explainer.md)\n\n观点（[00:01:02]）', 'wiki/concepts/context-compaction.md')).toContain('#t-000102'));
test('inline link in same parens sets source', async () =>
  expect(await md('观点（[视频](../videos/20261101-demo-explainer.md) [00:01:02]）', 'wiki/concepts/context-compaction.md')).toContain('#t-000102'));
test('paper anchor links to paper url', async () =>
  expect(await md('结论（§3.2）', 'wiki/papers/202611-sample-paper.md')).toMatch(/class="cite"[^>]*href="https:\/\/arxiv\.org/));
```

- [ ] **Step 2: 跑测试确认失败**：`npx vitest run tests/remark-wiki.test.ts`
- [ ] **Step 3: 实现 `remark-wiki.ts`、`rehype-transcript.ts`**
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 写 `content.config.ts` 和 `astro.config.mjs`**：
  - `docs: defineCollection({ loader: docsLoader(), schema: docsSchema({ extend: pageExtension }) })`。`pageExtension` 是把 Task 2 各类型字段全部设为可选、并 `passthrough` 的 `z.object`。严格校验由 prepare 负责（Starlight 的 `extend` 不接受 discriminated union），prepare 失败时构建就不会开始。
  - Starlight：`title: 'Agent LLM Wiki'`，默认语言 `zh-CN`，`customCss: ['./src/styles/tokens.css']`；侧边栏七组 autogenerate，依次为 主题、概念、论文、Blog、视频、播客、实体，分别对应 `wiki/topics` … `wiki/entities`；`components: { PageTitle }` 指向 Task 7 的覆盖组件（先写成直接渲染默认组件的占位）
  - `markdown.remarkPlugins: [[remarkWiki, { indexPath: '.generated/index.json', anchorsDir: 'public/data/anchors' }]]`，`rehypePlugins: [rehypeTranscript]`
  - `redirects`：读 `.generated/index.json` 的 `redirects`，转成 `toRoute` 形式
- [ ] **Step 6: 用迷你仓库冒烟**：`CONTENT_ROOT=../tests/fixtures/mini-repo npm run build`（prepare 读环境变量 `CONTENT_ROOT`，默认 `..`）。预期构建成功，`dist/wiki/papers/202611-sample-paper/index.html` 存在（Astro 设了 `base` 也输出在 `dist/` 根下），其中有 `class="cite"`。
- [ ] **Step 7: Commit**：`git add site && git commit -m "feat(site): Starlight config, wiki link rewriting and citation anchors"`

### Task 7: 页首两张卡片

**Files:**
- Create: `site/src/lib/labels.ts`、`site/src/lib/page-info.ts`、`site/src/components/{PageTitle.astro,MetaCard.astro,SourceCard.astro}`
- Test: `site/tests/page-info.test.ts`

**Interfaces:**
- Consumes: `.generated/index.json`（Task 5）
- Produces:
  - `TYPE_LABEL`：topic 主题、concept 概念、paper 论文、blog Blog、video 视频、podcast 播客、entity 实体
  - `REL_LABEL`：proposes 提出、extends 扩展、supports 支持、challenges 反驳、applies 使用、explains 讲解、responds 回应、part-of 属于、alternative-to 对照
  - `interface CardItem { text: string; href?: string; preview?: string; rel?: string; incoming?: boolean }`
  - `interface CardRow { label: string; items: CardItem[]; overflow: CardItem[] }`
  - `metaCard(id: PageId, idx: GeneratedIndex): CardRow[]`、`sourceCard(id: PageId, idx: GeneratedIndex): CardRow[]`
  - `PageTitle.astro`：先渲染 Starlight 默认标题，再按页面类型渲染卡片行：素材页左 `MetaCard`、右 `SourceCard`；概念页和主题页只渲染 `MetaCard`（概念卡字段）；raw 和 entity 页不加卡片。宽度 ≥ 50rem 时两列并排，否则上下堆叠

- [ ] **Step 1: 写失败测试**（索引用 Task 5 对迷你仓库生成的结果，另在测试里构造一个有 8 条关系的论文、一个播客、一个 blog 的 PageInfo）：

```ts
const labels = (rows: CardRow[]) => rows.map(r => r.label);
test('paper meta card rows', () => expect(labels(metaCard(PAPER, idx))).toEqual(['类型','方向','出自','相关']));
test('type row shows month', () => expect(metaCard(PAPER, idx)[0].items[0].text).toBe('论文 · 2026-11'));
test('related shows outgoing rel and incoming backlink', () => {
  const rel = metaCard(PAPER, idx)[3].items;
  expect(rel).toContainEqual(expect.objectContaining({rel:'提出', incoming:false}));
  expect(rel).toContainEqual(expect.objectContaining({rel:'讲解', incoming:true})); });
test('related caps at 6 with overflow', () => { const r = metaCard(EIGHT_RELS, idx8)[3]; expect(r.items).toHaveLength(6); expect(r.overflow).toHaveLength(2); });
test('paper source card', () => expect(labels(sourceCard(PAPER, idx))).toEqual(['作者','机构','发表','链接','总结']));
test('many authors collapse', () => expect(sourceCard(MANY_AUTHORS, idxA)[0].items[0].text).toBe('Peter Belcak、Saurav Muralidharan、Jindong Jiang 等 12 人'));
test('podcast source card', () => expect(labels(sourceCard(PODCAST, idxP))).toEqual(['节目','主持','嘉宾','时长','平台','总结']));
test('blog source card', () => expect(labels(sourceCard(BLOG, idxB))).toEqual(['作者','机构','发布','链接','总结']));
test('video source card', () => expect(labels(sourceCard(VIDEO, idx))).toEqual(['讲者','平台','时长','讲解对象','总结']));
test('concept card counts relations', () => {
  const rows = metaCard('wiki/concepts/context-compaction', idx);
  expect(labels(rows)).toEqual(['定义','所属主题','来源数']); expect(rows[2].items[0].text).toBe('2（提出 1 · 反驳 1）'); });
test('isolated concept shows zero', () => expect(metaCard('wiki/concepts/isolated-idea', idx)[2].items[0].text).toBe('0'));
```

- [ ] **Step 2: 跑测试确认失败**：`npx vitest run tests/page-info.test.ts`
- [ ] **Step 3: 实现 `labels.ts`、`page-info.ts`**：缺字段的行直接省略（如没有 `code` 就只列原文链接），空的"相关"显示"暂无"。
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 写三个组件**：卡片用 `--card-*` 变量，左边框用该类型的颜色变量；溢出的条目放进 `<details>`，不需要 JS。
- [ ] **Step 6: 冒烟**：迷你仓库构建后，论文页 HTML 里同时有"作者"和"相关"两行；窄屏布局留到 Task 9 的 e2e 检查。
- [ ] **Step 7: Commit**：`git add site && git commit -m "feat(site): meta and source cards on content pages"`

### Task 8: 构建时注入的自动段落

**Files:**
- Create: `site/src/lib/auto-sections.ts`
- Modify: `site/src/lib/remark-wiki.ts`（调用自动段落）
- Test: `site/tests/auto-sections.test.ts`

**Interfaces:**
- Consumes: `GeneratedIndex`（Task 5）、`REL_LABEL`（Task 7）、`toRoute`（Task 3）
- Produces:
  - `interface AutoItem { date?: string; title: string; href: string; rel?: string; note?: string }`
  - `autoSections(id: PageId, idx: GeneratedIndex): Record<string, AutoItem[]>`，键为二级标题：
    - 素材页：`关系`（出边和入边，入边的 rel 前加 `←`）
    - 概念页：`演化`（指向它的素材按 `date` 升序；`note` 取自发出方 relation 的 `note`）
    - 主题页：`最近进展`（`topics` 含该主题、或关联到属于该主题的概念的素材，按 `date` 降序取 10 条）
    - 实体页：`相关素材`（`by` 里指向它的素材，`note` 填该素材 `insights[0]`）
  - remark 注入规则：页面里有同名二级标题且标题下为空时，列表插在该标题下；没有该标题时，在文末追加标题和列表。每条渲染为 `日期 · [标题](href) · 关系 · note`，缺的部分省略。列表为空时写"暂无"。

- [ ] **Step 1: 写失败测试**：

```ts
test('concept evolution sorted by date', () =>
  expect(autoSections('wiki/concepts/context-compaction', idx)['演化'].map(i => i.date)).toEqual(['2026-11-03','2026-11-03']));
test('source relations include incoming with arrow', () =>
  expect(autoSections('wiki/papers/202611-sample-paper', idx)['关系'].map(i => i.rel)).toContain('← 讲解'));
test('topic recent progress caps at 10', () => expect(autoSections('wiki/topics/context', BIG_IDX)['最近进展']).toHaveLength(10));
test('empty topic gets empty list', () => expect(autoSections('wiki/topics/memory', idx)['最近进展']).toEqual([]));
test('entity lists its sources with first insight', () =>
  expect(autoSections('wiki/entities/demo-org', idx)['相关素材'][0].note).toBe(idx.pages['wiki/papers/202611-sample-paper'].insights[0]));
test('injected under existing empty heading, before next heading', async () => {
  const html = await md('## 定义\n\n一句话\n\n## 演化\n\n## 设计空间\n\n表', 'wiki/concepts/context-compaction.md');
  expect(html.indexOf('<li>')).toBeGreaterThan(html.indexOf('演化')); expect(html.indexOf('<li>')).toBeLessThan(html.indexOf('设计空间')); });
test('appended when heading missing', async () =>
  expect(await md('## 新认知\n\n- x', 'wiki/papers/202611-sample-paper.md')).toMatch(/<h2[^>]*>关系<\/h2>/));
```

- [ ] **Step 2: 跑测试确认失败**：`npx vitest run tests/auto-sections.test.ts`
- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑测试确认通过**，并重跑 `npx vitest run` 确认 Task 6 的测试仍通过
- [ ] **Step 5: Commit**：`git add site && git commit -m "feat(site): build-time backlinks, evolution, recent progress and entity lists"`

### Task 9: 悬停批注卡

**Files:**
- Create: `site/src/scripts/hovercard.ts`、`site/src/components/HoverCard.astro`
- Modify: `site/src/components/PageTitle.astro`（引入 `HoverCard`，让每个内容页都加载这段脚本）
- Test: `site/tests/hovercard.test.ts`（happy-dom 环境）、`site/e2e/content-page.spec.ts`

**Interfaces:**
- Consumes: 链接上的 `data-preview`、`data-term`、`data-key` 属性（Task 6），preview、glossary、anchors 三种 JSON（Task 5）
- Produces: `initHoverCards(doc: Document, opts?: { delay?: number; fetch?: typeof fetch }): () => void`（返回清理函数），`delay` 默认 150

- [ ] **Step 1: 写失败测试**（`vi.useFakeTimers()`，`fetch` 用 mock）：

```ts
test('leaving within 150ms cancels the request', () => { hover(link); vi.advanceTimersByTime(100); leave(link); vi.advanceTimersByTime(200); expect(fetchMock).not.toHaveBeenCalled(); });
test('hovering 150ms shows card with title and summary', async () => { hover(link); await vi.advanceTimersByTimeAsync(150);
  expect(doc.querySelector('.hovercard')!.textContent).toContain('上下文压缩'); });
test('same url fetched once', async () => { for (let i = 0; i < 3; i++) { hover(link); await vi.advanceTimersByTimeAsync(150); leave(link); } expect(fetchMock).toHaveBeenCalledTimes(1); });
test('404 shows nothing and does not throw', async () => { fetchMock.mockResolvedValue(new Response('', {status:404})); hover(link); await vi.advanceTimersByTimeAsync(150); expect(doc.querySelector('.hovercard')).toBeNull(); });
test('glossary card picks the term', async () => { hover(termLink); await vi.advanceTimersByTimeAsync(150); expect(doc.querySelector('.hovercard')!.textContent).toContain('BrowseComp-Plus'); });
test('anchor card shows source text', async () => { hover(citeLink); await vi.advanceTimersByTimeAsync(150); expect(doc.querySelector('.hovercard')!.textContent).toContain('第二段'); });
test('first touch tap previews, second navigates', async () => {
  expect(tap(link).defaultPrevented).toBe(true); await vi.advanceTimersByTimeAsync(0); expect(tap(link).defaultPrevented).toBe(false); });
test('content is inserted as text, not HTML', async () => { fetchMock.mockResolvedValue(json({title:'<img src=x onerror=alert(1)>'})); hover(link); await vi.advanceTimersByTimeAsync(150); expect(doc.querySelector('.hovercard img')).toBeNull(); });
```

- [ ] **Step 2: 跑测试确认失败**：`npx vitest run tests/hovercard.test.ts`
- [ ] **Step 3: 实现 `hovercard.ts`**：在 `document` 上做事件委托；卡片只用 `textContent` 填充；定位在链接下方，超出视口时翻到上方。
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 写 e2e** `site/e2e/content-page.spec.ts`（`playwright.config.ts` 的 webServer 先用迷你仓库 build，再 `astro preview`）：悬停论文页的概念链接，`.hovercard` 可见且含 summary；视口 375 px 宽时 MetaCard 的 `top` 小于 SourceCard 的 `top`；1280 px 宽时两者 `top` 相同。
- [ ] **Step 6: 跑 e2e**：`npx playwright install chromium && npm run e2e`，预期全部 PASS。
- [ ] **Step 7: Commit**：`git add site && git commit -m "feat(site): hover preview cards for links, terms and citations"`

## Phase 3 · 知识图谱

### Task 10: 图谱数据与构建期布局

**Files:**
- Create: `site/src/graph/build.ts`、`site/tests/helpers/synth.ts`、`site/data/graph-positions.json`（首次运行生成）
- Modify: `site/scripts/prepare.ts`（写出 `public/data/graph.json`，并更新 `data/graph-positions.json`）
- Test: `site/tests/graph-build.test.ts`

**Interfaces:**
- Consumes: `GeneratedIndex`（Task 5）
- Produces:
  - 紧凑格式（键名缩短是为了守住 150 KB 预算）：`interface GNode { id: PageId; t: PageType; l: string; s: string; tp: string[]; d?: string; o?: string; x: number; y: number; r: number }`（`l` 标题、`s` summary、`o` 机构名）；`interface GEdge { a: number; b: number; r: number }`（`a`、`b` 为节点下标，`r` 为 `REL` 下标）；`interface GraphData { nodes: GNode[]; edges: GEdge[]; al: Record<PageId, string[]> }`（`al` 是别名表，只收有别名的节点，供 Task 13 搜索）
  - `buildGraph(idx: GeneratedIndex, prev: Record<PageId, [number, number]>): GraphData`
  - `synthIndex(n: number): GeneratedIndex`（测试辅助：10 个主题、15% 概念、其余为素材，每个素材 2 条关系）
- 布局规则（spec §8.1）：
  - 根节点固定在 (0, 0)；主题按 `order` 均匀分布在半径 1000 的环上，位置固定；根与每个主题之间自动加一条 `part-of` 边
  - 概念的初始位置是所属主题的坐标均值；用 link 力连向所属主题（距离 260）
  - 素材连向关系最强的概念（`proposes` > `extends` > 其他，距离 90）
  - 实体连向它的素材（默认在前端隐藏）
  - 所有节点加碰撞力（半径 `r + 12`）
  - 随机源用 `d3.randomLcg(42)`；固定跑 300 tick；`prev` 里有的节点用旧坐标作为初值
  - 半径：根 60，主题 44，概念 `18 + 2 * sqrt(素材数)`，素材 6，实体 5

- [ ] **Step 1: 写失败测试**：

```ts
const g = buildGraph(idx, {});
const at = (id: string) => g.nodes.find(n => n.id === id)!;
const dist = (a: GNode, b: GNode) => Math.hypot(a.x - b.x, a.y - b.y);
test('deterministic', () => expect(JSON.stringify(buildGraph(idx, {}))).toBe(JSON.stringify(g)));
test('root at origin', () => expect([at('wiki/topics/agent').x, at('wiki/topics/agent').y]).toEqual([0, 0]));
test('topics on ring', () => expect(Math.abs(dist(at('wiki/topics/context'), at('wiki/topics/agent')) - 1000)).toBeLessThan(1));
test('concept near its topic', () => { const c = at('wiki/concepts/context-compaction');
  expect(dist(c, at('wiki/topics/context'))).toBeLessThan(dist(c, at('wiki/topics/memory'))); });
test('isolated concept has finite coords', () => { const c = at('wiki/concepts/isolated-idea'); expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true); });
test('existing nodes barely move when a source is added', () => {
  const prev = Object.fromEntries(g.nodes.map(n => [n.id, [n.x, n.y]]));
  const g2 = buildGraph(withExtraSource(idx), prev);
  for (const n of g.nodes) expect(dist(n, g2.nodes.find(m => m.id === n.id)!)).toBeLessThan(50); });
test('2000-node graph fits 150KB gzip', () =>
  expect(gzipSync(JSON.stringify(buildGraph(synthIndex(2000), {}))).length).toBeLessThanOrEqual(150 * 1024), 60_000);
```

- [ ] **Step 2: 跑测试确认失败**：`npx vitest run tests/graph-build.test.ts`
- [ ] **Step 3: 实现 `build.ts` 和 `synth.ts`**：坐标取整到整数，以减小体积。
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 接入 prepare**：prepare 写出 `public/data/graph.json`，并把全部节点坐标写回 `site/data/graph-positions.json`（录入后随内容一起提交，保持布局稳定）。
- [ ] **Step 6: Commit**：`git add site && git commit -m "feat(graph): build-time graph data with stable seeded layout"`

### Task 11: 渲染核心（相机、分档、水滴、裁剪、动画循环）

**Files:**
- Create: `site/src/graph/{camera.ts,lod.ts,droplet.ts,render.ts}`
- Test: `site/tests/graph-render.test.ts`

**Interfaces:**
- Consumes: `GraphData`（Task 10）、`tokens.css` 的颜色变量（Task 6）
- Produces:
  - `interface Camera { x: number; y: number; k: number }`；`worldToScreen(c, p)`、`screenToWorld(c, p)`；`zoomAt(c: Camera, screen: [number, number], factor: number): Camera`（缩放时屏幕上的这个点保持不动）；`flyTo(from: Camera, to: Camera, t: number): Camera`（`t` 取 0–1，ease-in-out）；`fitNode(n: GNode, view: { w: number; h: number }, level: 0 | 1 | 2): Camera`
  - `LEVEL_SCALE = [0.35, 1.0, 2.6]`、`L1_AT = 0.6`、`L2_AT = 1.8`、`BAND = 0.15`（阈值上下各 15% 的范围内交叉淡入淡出）
  - `lodAlpha(k: number): { topicLabel: number; conceptDot: number; conceptLabel: number; sourceDot: number; sourceCard: number }`
  - `dropletPoints(r: number, t: number, seed: number, reduced: boolean): [number, number][]`（8 个控制点）、`drift(t: number, seed: number, reduced: boolean): [number, number]`
  - `visibleIds(qt: Quadtree<GNode>, rect: { x0: number; y0: number; x1: number; y1: number }): Set<PageId>`
  - `createLoop(step: (t: number) => void, doc: Document): { start(): void; stop(): void }`：标签页隐藏时停止 `requestAnimationFrame`
  - `createRenderer(canvas: HTMLCanvasElement, data: GraphData): { draw(cam: Camera, state: ViewState): void }`；`ViewState = { hover?: PageId; focus?: PageId; visible: Set<PageId>; reducedMotion: boolean }`

- [ ] **Step 1: 写失败测试**：

```ts
test('zoomAt keeps the anchor point fixed', () => { const c = zoomAt({x:0,y:0,k:1}, [200,100], 2);
  expect(worldToScreen(c, screenToWorld({x:0,y:0,k:1}, [200,100]))).toEqual([200,100]); });
test('L0 hides concept labels and sources', () => expect(lodAlpha(0.3)).toMatchObject({conceptLabel:0, sourceDot:0, conceptDot:1}));
test('L1 shows concept labels and source dots, no cards', () => expect(lodAlpha(1)).toMatchObject({conceptLabel:1, sourceDot:1, sourceCard:0}));
test('L2 shows cards instead of dots', () => expect(lodAlpha(3)).toMatchObject({sourceCard:1, sourceDot:0}));
test('crossfade midpoint at threshold', () => expect(lodAlpha(L1_AT).conceptLabel).toBeCloseTo(0.5));
test('alphas are monotonic in k', () => { let prev = 0; for (let k = 0.1; k < 3; k += 0.05) { const a = lodAlpha(k).sourceCard; expect(a).toBeGreaterThanOrEqual(prev); prev = a; } });
test('droplet wobble within 6% of r', () => { for (const [x,y] of dropletPoints(20, 1.7, 3, false)) expect(Math.abs(Math.hypot(x,y) - 20)).toBeLessThanOrEqual(1.2); });
test('reduced motion is a still circle', () => {
  expect(dropletPoints(20, 0, 3, true)).toEqual(dropletPoints(20, 9, 3, true)); expect(drift(5, 3, true)).toEqual([0,0]); });
test('drift amplitude ≤ 2px', () => { for (let t = 0; t < 10; t += 0.3) expect(Math.hypot(...drift(t, 7, false))).toBeLessThanOrEqual(2); });
test('culling returns only nodes in rect', () => expect(visibleIds(qtOf(g), {x0:-100,y0:-100,x1:100,y1:100})).toEqual(new Set(['wiki/topics/agent'])));
test('loop stops when tab hidden', () => { const step = vi.fn(); const loop = createLoop(step, document); loop.start();
  setHidden(true); runFrames(3); const n = step.mock.calls.length; runFrames(3); expect(step.mock.calls.length).toBe(n); });
```

- [ ] **Step 2: 跑测试确认失败**：`npx vitest run tests/graph-render.test.ts`
- [ ] **Step 3: 实现**：`render.ts` 用 Canvas 2D；水滴用径向渐变（中心亮、边缘半透明）加一个高光点和 `shadowBlur` 投影；L2 的素材卡片画圆角矩形（类型色条、标题、机构 · 日期、一行 summary）。颜色在运行时从 CSS 变量读取，切换深色模式时重新读取。
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: Commit**：`git add site && git commit -m "feat(graph): camera, semantic zoom, droplet rendering and culling"`

### Task 12: 图谱首页与交互

**Files:**
- Create: `site/src/pages/index.astro`、`site/src/components/GraphApp.astro`、`site/src/graph/{interaction.ts,hash.ts,main.ts}`
- Test: `site/tests/graph-interaction.test.ts`、`site/e2e/graph.spec.ts`

**Interfaces:**
- Consumes: Task 10、Task 11 的全部导出；`REL_LABEL`、`toRoute`（Task 7、Task 3）；`/data/previews/*.json`（Task 5）
- Produces:
  - `neighbors(id: PageId, data: GraphData): Set<PageId>`
  - `hitTest(qt: Quadtree<GNode>, world: [number, number], k: number): GNode | null`（在 L2 时按卡片矩形判定，其他档按圆判定）
  - `clickAction(n: GNode, level: 0 | 1 | 2): { kind: 'fly'; level: 1 | 2; focus: PageId } | { kind: 'navigate'; href: string }`：主题飞到 L1，概念飞到 L2，素材和实体直接打开页面
  - `encodeView(v: { node?: PageId; z: 0 | 1 | 2 }): string` → `#node=<id>&z=<n>`；`decodeView(hash: string, ids: Set<PageId>): { node?: PageId; z: 0 | 1 | 2 }`，未知节点或格式错误一律返回 `{ z: 0 }`
  - 容器元素上的状态属性 `data-level`、`data-focus`（供 e2e 读取）
  - 侧边预览面板：标题、summary、"打开页面"；主题和概念另列出最近 3 份相关素材的 `insight`（按需请求它们的 preview JSON）

- [ ] **Step 1: 写失败测试**：

```ts
test('topic click flies to L1', () => expect(clickAction(node('wiki/topics/context'), 0)).toEqual({kind:'fly', level:1, focus:'wiki/topics/context'}));
test('concept click flies to L2', () => expect(clickAction(node('wiki/concepts/context-compaction'), 1)).toMatchObject({kind:'fly', level:2}));
test('source click navigates', () => expect(clickAction(node('wiki/papers/202611-sample-paper'), 2)).toEqual({kind:'navigate', href:'/awesome-agent-llm-wiki/wiki/papers/202611-sample-paper/'}));
test('neighbors of concept', () => expect(neighbors('wiki/concepts/context-compaction', g)).toEqual(new Set(['wiki/topics/context','wiki/papers/202611-sample-paper'])));
test('hash round trip', () => expect(decodeView(encodeView({node:'wiki/topics/context', z:1}), ids)).toEqual({node:'wiki/topics/context', z:1}));
test('unknown node falls back to L0', () => expect(decodeView('#node=wiki/concepts/nope&z=2', ids)).toEqual({z:0}));
test('garbage hash falls back to L0', () => expect(decodeView('#%%%', ids)).toEqual({z:0}));
```

- [ ] **Step 2: 跑测试确认失败**：`npx vitest run tests/graph-interaction.test.ts`
- [ ] **Step 3: 实现 `interaction.ts`、`hash.ts`**
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 写 `main.ts`、`GraphApp.astro`、`index.astro`**：
  - 首页不用 Starlight 布局：全屏 canvas，顶栏放站名、搜索框（Task 13）、过滤按钮（Task 13）、"目录"链接（指向 `wiki/` 首页）
  - 滚轮和双指缩放用 `zoomAt`，拖动平移；键盘 `+`、`-` 每次缩放 1.25 倍，`0` 回到 L0 全局视图
  - 悬停节点：它和邻居保持不透明，其余透明度降到 0.15，相连的边上画 `REL_LABEL`
  - 点击按 `clickAction` 处理；飞行动画 400 ms，用 `flyTo`
  - 视图变化后 300 ms 内无新变化时，用 `history.replaceState` 写入 hash；点击飞行用 `pushState`，因此浏览器后退能回到上一个视图
  - `prefers-reduced-motion` 时把 `reduced` 传给水滴和漂浮函数，飞行动画改为直接跳转
- [ ] **Step 6: 写 e2e** `site/e2e/graph.spec.ts`：打开首页，canvas 可见且 `data-level=0`；打开 `#node=wiki/topics/context&z=1`，`data-focus` 为该 id、`data-level=1`；打开 `#node=nope&z=2`，`data-level=0` 且控制台没有错误；按 `+` 三次后 `data-level` 增大；点"打开页面"会跳到对应页面。
- [ ] **Step 7: 跑 e2e**：`npm run e2e`，预期 PASS。
- [ ] **Step 8: Commit**：`git add site && git commit -m "feat(graph): homepage with zoom, hover, click-to-fly, panel and shareable view"`

### Task 13: 图谱搜索与过滤

**Files:**
- Create: `site/src/graph/search.ts`、`site/src/graph/filters.ts`
- Modify: `site/src/graph/main.ts`、`site/src/components/GraphApp.astro`
- Test: `site/tests/graph-search.test.ts`，并在 `site/e2e/graph.spec.ts` 里追加用例

**Interfaces:**
- Consumes: `GraphData`、`GNode`（Task 10）；`fitNode`（Task 11）
- Produces:
  - `searchNodes(q: string, nodes: GNode[], aliases: Record<PageId, string[]>, limit = 8): GNode[]`：先做 NFKC 规范化并转小写；打分为标题前缀 3、标题包含 2、别名包含 2、summary 包含 1；同分时按 主题 > 概念 > 素材 排序；空查询返回 `[]`
  - `interface Filters { types: Set<'paper'|'blog'|'video'|'podcast'>; from?: string; to?: string; rels: Set<Rel>; entities: boolean }`，`DEFAULT_FILTERS` 为四种类型和全部 rel 都选中、`entities: false`
  - `applyFilters(data: GraphData, f: Filters): Set<PageId>`：根、主题、概念始终可见；素材按类型和日期（`YYYY-MM`，含边界）过滤；实体只在 `entities` 为 true 时可见
  - `graph.json` 里的别名表 `al` 已由 Task 10 输出
  - Pagefind 回退：回车时没有节点结果，就动态 `import(\`${BASE}/pagefind/pagefind.js\`)`，在下拉框列出前 5 条全文结果

- [ ] **Step 1: 写失败测试**：

```ts
test('Chinese substring hits concept title', () => expect(searchNodes('压缩', nodes, al)[0].id).toBe('wiki/concepts/context-compaction'));
test('alias match', () => expect(searchNodes('compaction', nodes, {'wiki/concepts/context-compaction':['compaction']})[0].id).toBe('wiki/concepts/context-compaction'));
test('topic ranks above source on tie', () => expect(searchNodes('context', nodes, al).map(n => n.t).slice(0,1)).toEqual(['topic']));
test('empty query returns nothing', () => expect(searchNodes('  ', nodes, al)).toEqual([]));
test('entities hidden by default', () => expect(applyFilters(gWithEntity, DEFAULT_FILTERS).has('wiki/entities/demo-org')).toBe(false));
test('date range excludes later sources', () => expect(applyFilters(g, {...DEFAULT_FILTERS, to:'2026-10'}).has('wiki/papers/202611-sample-paper')).toBe(false));
test('concepts always visible', () => expect(applyFilters(g, {...DEFAULT_FILTERS, types:new Set()}).has('wiki/concepts/isolated-idea')).toBe(true));
```

- [ ] **Step 2: 跑测试确认失败**：`npx vitest run tests/graph-search.test.ts`
- [ ] **Step 3: 实现**，并接进 `main.ts`：输入时即时显示下拉结果，回车飞到第一个结果（`fitNode` 到该节点对应的档位）；过滤面板改变时重算可见集合，边只在两端都可见、且 rel 被选中时绘制。
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 追加 e2e**：输入"压缩"回车，`data-focus` 变为该概念；输入"zzzz"回车，出现 Pagefind 结果框（允许为空列表，但不能报错）。
- [ ] **Step 6: 跑 e2e**：`npm run e2e`
- [ ] **Step 7: Commit**：`git add site && git commit -m "feat(graph): instant node search, Pagefind fallback and filters"`

### Task 14: 性能门槛、Lighthouse 与部署流水线

**Files:**
- Create: `site/scripts/check-budgets.ts`、`site/lighthouserc.cjs`、`.github/workflows/pages.yml`
- Modify: `site/package.json`（`build` 末尾接 `tsx scripts/check-budgets.ts`；dev 依赖加 `esbuild`）、`README.md`
- Test: `site/tests/budgets.test.ts`

**Interfaces:**
- Consumes: `src/scripts/hovercard.ts`（Task 9）、`src/graph/main.ts`（Task 12）、`dist/data/graph.json`
- Produces:
  - `bundleGzipSize(entry: string): Promise<number>`：用 esbuild 把入口单独打包并压缩（`bundle: true, minify: true, format: 'esm'`），返回 gzip 字节数。这样量的是本库自己的代码，不含 Starlight 自带脚本
  - `BUDGETS = { hovercard: 10 * 1024, graph: 80 * 1024, graphData: 150 * 1024 }`
  - `checkBudgets(distDir: string): Promise<{ name: string; size: number; limit: number; ok: boolean }[]>`；CLI 打印表格，任一项超标则退出码 1

- [ ] **Step 1: 写失败测试**：

```ts
test('hovercard bundle within 10KB', async () => expect(await bundleGzipSize('src/scripts/hovercard.ts')).toBeLessThanOrEqual(BUDGETS.hovercard));
test('graph bundle within 80KB', async () => expect(await bundleGzipSize('src/graph/main.ts')).toBeLessThanOrEqual(BUDGETS.graph));
test('over-budget fails', async () => { const r = await checkBudgets(fakeDistWithHugeGraphJson); expect(r.find(x => x.name === 'graphData')!.ok).toBe(false); });
```

- [ ] **Step 2: 跑测试确认失败**：`npx vitest run tests/budgets.test.ts`
- [ ] **Step 3: 实现 `check-budgets.ts`**
- [ ] **Step 4: 跑测试确认通过**；超标时先查是不是把 d3 整包打进来了（只引 `d3-force` 和 `d3-quadtree` 的子模块，且 `d3-force` 只在构建期使用，不进浏览器包）
- [ ] **Step 5: 写 `lighthouserc.cjs`**：`startServerCommand: 'npx astro preview --port 4321'`；URL 为首页，加上从 `.generated/index.json` 里各挑第一篇的 paper、blog、podcast 页（存在哪种就测哪种）；`numberOfRuns: 3`；断言 `categories:performance` `minScore: 0.95`（Lighthouse 默认移动端模拟）。
- [ ] **Step 6: 写 `.github/workflows/pages.yml`**：push 到 main 或手动触发时运行，权限 `contents: read`、`pages: write`、`id-token: write`，`concurrency: pages`。build job 依次执行：checkout → setup-node（Node 24，npm 缓存指向 `site/package-lock.json`）→ setup-uv → `uv run scripts/lint.py --ci` → `cd site && npm ci && npm test` → `npx playwright install --with-deps chromium && npm run e2e`（用迷你仓库构建）→ `npm run build`（用真实内容，含预算检查）→ `npx lhci autorun` → `actions/upload-pages-artifact`（`path: site/dist`）。deploy job 用 `actions/deploy-pages`。各 action 用当前的主版本（ai-kol-wiki 用的是 `actions/checkout@v7`、`astral-sh/setup-uv@v8.3.2`）。
- [ ] **Step 7: 本地验证**：`cd site && npm run build && npx lhci autorun`。用迷你仓库时 lint 那一步跳过。预期预算表全部 ok，Lighthouse 断言通过。
- [ ] **Step 8: README**：一段项目介绍（取自 spec §1）、站点链接、目录说明、录入命令（Task 15–17 完成后回填）。
- [ ] **Step 9: Commit**：`git add -A && git commit -m "ci: budgets, Lighthouse gate and GitHub Pages deploy"`

## Phase 4 · 抓取与巡检（Python）

所有 Python 脚本用 PEP 723 内联依赖，`uv run scripts/<name>.py` 运行；测试用 `uv run --with pytest --with pyyaml pytest scripts/tests -q`。`scripts/` 是脚本所在目录，会自动进 `sys.path`，所以可以 `from lib.anchors import ...`。

### Task 15: lint.py

**Files:**
- Create: `scripts/lint.py`、`scripts/lib/__init__.py`、`scripts/lib/anchors.py`
- Test: `scripts/tests/test_lint.py`、`scripts/tests/test_anchors.py`

**Interfaces:**
- Consumes: `tests/fixtures/mini-repo`（Task 3）
- Produces:
  - `lib/anchors.py`：`parse_anchors_md(text: str) -> dict[str, str]`，格式与 Task 4 的 `parseAnchorsMd` 完全一致；`parse_transcript_anchors(text: str) -> set[str]`；`find_citations(text: str) -> list[str]`；`verify_against_fulltext(anchors: dict[str, str], fulltext: str) -> list[str]`（标题和引用短句须在全文中逐字出现，比较前把连续空白压成一个空格）
  - `lint.py`：`lint(root: Path, ci: bool = False, today: date | None = None) -> list[Issue]`；`Issue = (level: 'error' | 'warn', path: str, msg: str)`。CLI 打印 `🔴`（error）或 `🟡`（warn）加路径和说明，有 error 时退出码 1；`--ci` 跳过 `.cache` 全文核验
- 检查项：

| 检查 | 级别 |
|---|---|
| 关系目标、`by.entity` 指向的页面不存在 | error |
| 引用的锚点在信源里不存在（信源判定规则同 Task 6 的三条） | error |
| `.cache` 有全文时，`anchors.md` 的标题或短句在全文中找不到（`--ci` 跳过） | error |
| `sources/` 下已提交的文件被修改；`anchors.md` 删除或改动了已有行（与 `git show HEAD:<path>` 比较；不是 git 仓库或文件未跟踪时跳过） | error |
| 素材页缺少 `## 新认知`，或其中有条目没有锚点 | error |
| summary 超过 60 字 | error |
| `新认知` 条数不在 3–10 之间 | warn |
| 两个概念的标题或别名（不区分大小写）相同 | warn |
| 孤儿页（没有入边、没有被任何页面链接） | warn |
| 页面没有被 `wiki/index.md` 链接 | warn |
| `sources/` 下有目录但没有任何素材页的 `source_dir` 指向它，且不在 `skipped.txt` | warn |
| `## 可验证的预测` 表格里 `到期` 早于今天、`状态` 仍为"待验证" | warn |

- [ ] **Step 1: 写失败测试**（把迷你仓库复制到 `tmp_path`，再按用例改动）：

```python
def test_mini_repo_has_only_the_known_bad_anchor(repo):
    errs = [i for i in lint(repo, ci=True) if i[0] == 'error']
    assert [(p, 'anchor' in m) for _, p, m in errs] == [('wiki/videos/20261101-demo-explainer.md', True)]
def test_missing_relation_target(repo): add_relation(repo, 'wiki/papers/202611-sample-paper.md', 'concept', 'nope'); assert has_error(lint(repo, ci=True), 'nope')
def test_insight_without_anchor(repo): append_insight(repo, 'wiki/papers/202611-sample-paper.md', '- 一条没有锚点的认知'); assert has_error(lint(repo, ci=True), '新认知')
def test_changed_anchor_line_is_error(git_repo): edit_line(git_repo, 'sources/papers/2611.00001/anchors.md', 0, '## §3.2 Changed'); assert has_error(lint(git_repo, ci=True), 'anchors.md')
def test_appended_anchor_line_is_fine(git_repo): append(git_repo, 'sources/papers/2611.00001/anchors.md', '- Tab. 9 — new'); assert not has_error(lint(git_repo, ci=True), 'anchors.md')
def test_cache_verification(repo): write_cache(repo, 'papers/2611.00001/paper.md', 'no matching text'); assert has_error(lint(repo), '§3.2')
def test_cache_skipped_in_ci(repo): write_cache(repo, 'papers/2611.00001/paper.md', 'no matching text'); assert not has_error(lint(repo, ci=True), '§3.2')
def test_expired_prediction(repo): add_prediction(repo, '2026-01', '待验证'); assert has_warn(lint(repo, ci=True, today=date(2026, 11, 26)), '预测')
def test_alias_collision(repo): add_alias(repo, 'wiki/concepts/isolated-idea.md', 'Context Compaction'); assert has_warn(lint(repo, ci=True), '别名')
def test_parse_anchors_md_matches_ts_format():
    m = parse_anchors_md('## §3.2 Method\n- Fig. 4 — Accuracy\n- Tab. 2 — Cost\n- §3.2: "we compact every 8 turns"\n- §2¶3: "q"')
    assert sorted(m) == ['Fig. 4', 'Tab. 2', '§2¶3', '§3.2'] and m['§3.2'] == 'we compact every 8 turns'
```

  注：迷你仓库里那条不存在的锚点 `[09:09:09]` 是 TS 和 Python 两套实现共用的"契约"。两边对它的判定必须一致：Task 6 渲染成纯文本，这里报 error。
- [ ] **Step 2: 跑测试确认失败**：`uv run --with pytest --with pyyaml pytest scripts/tests -q`
- [ ] **Step 3: 实现 `lib/anchors.py` 和 `lint.py`**
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 回填 CLAUDE.md、AGENTS.md 的 lint 命令**，然后 Commit：`git add scripts CLAUDE.md AGENTS.md && git commit -m "feat(scripts): lint with anchor, append-only and quality checks"`

### Task 16: 转录公共库、视频与播客抓取

**Files:**
- Create: `scripts/lib/transcribe.py`、`scripts/fetch_video.py`、`scripts/fetch_podcast.py`、`scripts/tests/fixtures/xiaoyuzhou_episode.html`
- Test: `scripts/tests/test_transcribe.py`、`scripts/tests/test_fetch_podcast.py`

**Interfaces:**
- Produces:
  - `lib/transcribe.py`（从 `../ai-kol-wiki/scripts/fetch.py` 移植 `transcribe_with_whisper`、`_ensure_cuda_libs`、`fmt_ts`，不带说话人分离）：
    - `transcribe(audio: Path, model: str = 'large-v3-turbo', lang: str = 'zh', device: str = 'auto') -> list[tuple[float, float, str]]`
    - `format_anchored(segs: list[tuple[float, float, str]], anchor_every: int = 60) -> str`：距上一个锚点满 `anchor_every` 秒的片段起新一行，行首写 `[HH:MM:SS]`
    - `write_transcript(dest: Path, meta: dict, body: str) -> Path`：frontmatter 键为 `title`、`url`、`channel`（视频）或 `show`（播客）、`upload_date`、`duration_minutes`、`subtitle`（字幕来源说明）、`fetched`，并把 id 追加到 `sources/seen.txt`
  - `fetch_video.py <url> --channel <slug> [--transcribe] [--lang zh]`：yt-dlp 取元数据，有字幕就用字幕，没有就在 `--transcribe` 时下载音频转录；输出 `sources/videos/<channel>/<YYYYMMDD>-<id>/transcript.md`（B 站的 id 用 BV 号）
  - `fetch_podcast.py <episode-url> --show <slug>`：从页面的 `<script id="__NEXT_DATA__">` 取单集数据，音频下载到 `.cache/audio/`，转录后输出 `sources/podcasts/<show>/<YYYYMMDD>-<eid>/transcript.md`；shownotes 写进 frontmatter 的 `description`
  - `parse_episode(html: str) -> dict`：返回 `{eid, title, show_title, audio_url, pub_date: 'YYYYMMDD', duration_minutes, description}`；找不到 `__NEXT_DATA__` 或音频地址时抛 `ValueError`，信息里说明缺的是哪一项

- [ ] **Step 1: 取真实页面做 fixture**：`curl -sL -A 'Mozilla/5.0' https://www.xiaoyuzhoufm.com/episode/6af00645b4a4e20202f67440 -o /tmp/xyz.html`，确认 `__NEXT_DATA__` 里单集字段的真实路径（预期在 `props.pageProps.episode` 下，音频地址在 `enclosure.url` 或 `media.source.url`），再裁剪成只含这些字段的小文件存为 fixture。
- [ ] **Step 2: 写失败测试**：

```python
def test_format_anchored_groups_by_60s():
    out = format_anchored([(0, 5, 'a'), (30, 35, 'b'), (61, 70, 'c'), (125, 130, 'd')])
    assert [l[:10] for l in out.splitlines()] == ['[00:00:00]', '[00:01:01]', '[00:02:05]']
def test_parse_episode_fixture():
    ep = parse_episode(FIXTURE.read_text())
    assert ep['eid'] == '6af00645b4a4e20202f67440' and ep['show_title'].startswith('十字路口') and ep['duration_minutes'] == 41
    assert ep['audio_url'].startswith('https://') and len(ep['pub_date']) == 8
def test_parse_episode_without_next_data():
    with pytest.raises(ValueError, match='__NEXT_DATA__'): parse_episode('<html></html>')
```

- [ ] **Step 3: 跑测试确认失败**
- [ ] **Step 4: 实现三个文件**
- [ ] **Step 5: 跑测试确认通过**
- [ ] **Step 6: Commit**：`git add scripts && git commit -m "feat(scripts): shared whisper transcription, video and xiaoyuzhou podcast fetchers"`

### Task 17: 论文与 blog 抓取

**Files:**
- Create: `scripts/fetch_paper.py`、`scripts/fetch_blog.py`、`scripts/tests/fixtures/{arxiv_atom.xml,arxiv_html_snippet.html,pdf_text.txt,blog_article.md}`
- Test: `scripts/tests/test_fetch_paper.py`、`scripts/tests/test_fetch_blog.py`

**Interfaces:**
- Consumes: `lib/anchors.py` 的 `parse_anchors_md`（Task 15）
- Produces:
  - `fetch_paper.py <arxiv-url-or-id>`：
    - `parse_arxiv_id(s: str) -> str`：支持 `https://arxiv.org/abs/2611.05306`、`.../pdf/2611.05306v2`、`2611.05306`，去掉版本号
    - `parse_atom(xml: str) -> dict`：写入 `sources/papers/<id>/meta.yaml`，键为 `id`、`title`、`authors`、`published`、`updated`、`abs_url`、`pdf_url`、`primary_category`、`comment`
    - `anchors_from_html(html: str) -> list[str]`：取 arXiv HTML 版的章节标题（`.ltx_title`，如 "3.2 Method" → `## §3.2 Method`）、图题（"Figure 4: …" → `- Fig. 4 — …`）、表题（`- Tab. 2 — …`），说明截到 120 字
    - `anchors_from_pdf_text(text: str) -> list[str]`：HTML 版取不到（非 200）时的回退；章节用 `^(\d+(?:\.\d+)*)\s+([A-Z][^\n]{2,80})$`，图表用 `^(Figure|Fig\.|Table)\s*(\d+)[:.]\s*(.+)`
    - `merge_anchors(existing: str, new: list[str]) -> str`：只在末尾追加 `existing` 里没有的键，不改已有行
    - 全文写到 `.cache/papers/<id>/paper.md`
  - `fetch_blog.py <url> --org <slug>`：
    - 用 trafilatura 抽正文（`output_format='markdown'`，保留标题）和元数据（标题、作者、日期）
    - `number_blog(md: str) -> tuple[str, list[str]]`：第一个 `##` 之前的内容算 §0；每个 `##` 依次为 §1、§2…；每节内的段落依次为 ¶1、¶2…。返回 `(带 §n¶m 前缀的全文, anchors 行列表)`，anchors 只含 `## §n <标题>` 行
    - 输出 `sources/blogs/<org>/<YYYYMMDD>-<slug>/meta.yaml` 和 `anchors.md`，全文写到 `.cache/blogs/<org>/<YYYYMMDD>-<slug>/article.md`；`slug` 取标题的 `termSlug` 规则，截到 60 字符

- [ ] **Step 1: 写失败测试**：

```python
def test_parse_arxiv_id():
    assert {parse_arxiv_id(s) for s in ['https://arxiv.org/abs/2611.05306', 'https://arxiv.org/pdf/2611.05306v2', '2611.05306']} == {'2611.05306'}
def test_anchors_from_html(): assert anchors_from_html(HTML)[:2] == ['## §1 Introduction', '## §3.2 Method']
def test_figure_caption_truncated(): assert all(len(l) <= 140 for l in anchors_from_html(HTML) if l.startswith('- Fig.'))
def test_pdf_fallback(): assert '- Tab. 2 — Compute per trial' in anchors_from_pdf_text(PDF_TEXT)
def test_merge_is_append_only():
    old = '## §1 Introduction\n- §1: "kept quote"\n'
    assert merge_anchors(old, ['## §1 Introduction (changed)', '## §2 Method']).startswith(old)
def test_number_blog():
    text, anchors = number_blog('Intro para\n\n## Evidence\n\nP1\n\nP2\n\n## Future\n\nP3')
    assert anchors == ['## §1 Evidence', '## §2 Future'] and '§1¶2 P2' in text and '§0¶1 Intro para' in text
```

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 真实冒烟**：`uv run scripts/fetch_paper.py 2611.05306`，`sources/papers/2611.05306/anchors.md` 里有 `## §` 行和 `- Fig.` 行，`.cache/papers/2611.05306/paper.md` 非空。`uv run scripts/fetch_blog.py https://www.anthropic.com/institute/recursive-self-improvement --org anthropic`，anchors 里有 "Evidence from the outside world" 等六个章节。这两份产物保留，供 Task 20、Task 21 使用。
- [ ] **Step 6: 回填 CLAUDE.md、AGENTS.md、README 的抓取命令**，然后 Commit：`git add scripts sources CLAUDE.md AGENTS.md README.md && git commit -m "feat(scripts): arXiv paper and blog fetchers with anchors"`

## Phase 5 · v1 内容

内容任务不走 TDD。每个任务按 CLAUDE.md 的录入流程执行：抓取 → 完整阅读 → 写素材页 → 先查重再建或改概念页 → 更新主题页、实体页、术语表 → 更新 `wiki/index.md` → 在 `wiki/log.md` 追加一行。

**每个内容任务的通过标准**（审阅者逐条核对）：
1. `uv run scripts/lint.py` 没有 error（本地运行，含 `.cache` 全文核验）。
2. `cd site && npm run build` 成功（含预算检查）。
3. `## 新认知` 每条都是判断式的新看法，不是"讲了什么"；至少一条加粗；每条链接到对应的概念页。
4. 论文的 `## 核心问题` 说出了本质问题；`## 效果` 表里的每个数字都能用它的锚点在原文中找到。
5. 新建概念页前查过 `title` 和 `aliases`；同一想法没有重复建页。
6. `astro preview` 下抽查一页：两张卡片字段齐全，悬停链接和锚点都能弹出卡片。

### Task 18: 主题、根节点与术语表

**Files:** `wiki/topics/{agent,context,memory,rsi,continual-learning}.md`、`wiki/glossary.md`、`wiki/index.md`

- [ ] **Step 1:** `agent.md`：`root: true`、`order: 0`。其余四个主题的 `order` 依次为 1–4（根与主题之间的边由 `buildGraph` 自动生成，主题页不写关系），正文写 `## 这个方向在解决什么`（三五句）、`## 概念地图`、`## 关键争论`，以及空的 `## 最近进展` 标题（构建时自动填充）。
- [ ] **Step 2:** 术语表先收样例里已知会出现的术语：GRPO、SGLang、BrowseComp-Plus、TerminalBench、SWE-bench、CORE-Bench、OpenEvolve。每条一两句，写法见 CLAUDE.md。
- [ ] **Step 3:** 按通过标准验证，然后 Commit：`git commit -am "content: root topic, four topics and glossary"`（新文件先 `git add`）

### Task 19: CLM 论文与 B 站讲解视频

- [ ] **Step 1:** `uv run scripts/fetch_paper.py 2609.37725`，写 `wiki/papers/202609-context-language-models.md`（会议名 ICLR27 写进 `venue`，以原文为准）。
- [ ] **Step 2:** `uv run scripts/fetch_video.py 'https://www.bilibili.com/video/BV1wd1wzkEU6/' --channel agent-deep-research --transcribe`，写 `wiki/videos/<YYYYMMDD>-agent-deep-research-clm.md`。这个视频讲的是 CLM，所以要有 `{ source: papers/202609-context-language-models, rel: explains }`，正文只写 `## 新认知`、`## 讲者的增量与偏差`、`## 时间线` 三节（spec §7.2）。
- [ ] **Step 3:** 概念页：按读到的内容判断，预计会有"模型自管理上下文"、"后缀缓存复用"这一类概念，但以全文为准；它们 `part-of` context。
- [ ] **Step 4:** 按通过标准验证；Commit：`git add -A && git commit -m "content: CLM paper and Bilibili explainer"`

### Task 20: 论文《You don't need long context》

- [ ] **Step 1:** 用 Task 17 冒烟时抓好的 `sources/papers/2611.05306`，写 `wiki/papers/202611-you-dont-need-long-context.md`。
- [ ] **Step 2:** 和 CLM 落在同一个概念的设计空间里做对照：它主张频繁压缩上下文，CLM 主张模型自己编辑上下文。关系用 `alternative-to` 还是 `challenges`，读完全文再定。在相关概念页的 `## 设计空间` 表里并列两条路线。
- [ ] **Step 3:** 按通过标准验证；Commit：`git add -A && git commit -m "content: You don't need long context"`

### Task 21: Anthropic《When AI builds itself》

- [ ] **Step 1:** 用 Task 17 冒烟时抓好的 `sources/blogs/anthropic/...`，写 `wiki/blogs/<YYYYMMDD>-anthropic-when-ai-builds-itself.md`，日期用 2026-09-18（更新日期，以页面为准）。
- [ ] **Step 2:** `## 论证与证据` 表要区分内部数据和外部基准；`## 立场` 写明这是实验室在主张协调放缓；`## 可验证的预测` 里每条都写到期时间。
- [ ] **Step 3:** 建 `wiki/entities/anthropic.md`；作者 Marina Favaro、Jack Clark 是否建实体页，看是否会被其他素材再次引用。
- [ ] **Step 4:** 按通过标准验证；Commit：`git add -A && git commit -m "content: Anthropic RSI blog"`

### Task 22: 十字路口对话谷雨

- [ ] **Step 1:** `uv run scripts/fetch_podcast.py https://www.xiaoyuzhoufm.com/episode/6af00645b4a4e20202f67440 --show crossing`。按用户决定独立转录，不复用 ai-kol-wiki 的转录稿。
- [ ] **Step 2:** 写 `wiki/podcasts/<YYYYMMDD>-crossing-gu-yu.md`：页首说明块写说话人映射和专名还原；`## 分歧` 写清嘉宾的利益相关（他的公司做 continual learning）。
- [ ] **Step 3:** 和 Anthropic blog 在 RSI 相关概念上对接；continual learning、memory 方面的观点挂到对应主题下的概念上。
- [ ] **Step 4:** 按通过标准验证；Commit：`git add -A && git commit -m "content: Crossing podcast with Gu Yu"`

### Task 23–25: 补录经典论文（spec §11.1）

三批，每批一个任务、一次提交。每篇的流程都一样：先用 arXiv API 核对编号和标题（`fetch_paper.py` 会写进 `meta.yaml`，标题对不上就停下来查），再按论文模板写页面。

| Task | 主题 | 论文 |
|---|---|---|
| 23 | memory、context | Generative Agents、MemGPT、A-MEM、Mem0、Lost in the Middle、LLMLingua、ACE: Agentic Context Engineering |
| 24 | agent 基础、continual-learning | ReAct、Toolformer、SWE-agent、Voyager、Reflexion |
| 25 | rsi | STaR、Self-Rewarding Language Models、Darwin Gödel Machine、The AI Scientist |

- [ ] **每个任务的 Step 1:** 逐篇抓取并写论文页。
- [ ] **Step 2:** 去重重点（spec §11.1）：MemGPT 的分层记忆、CLM 的模型自管理上下文、ACE 的上下文演化，要放进同一张设计空间对比表，而不是各开一页互不相连。旧论文成为某个概念的最早来源时，把该概念演化线上的 `proposes` 改挂到它身上，后来者改为 `extends`。
- [ ] **Step 3:** 按 Phase 5 的通过标准验证；Commit：`git add -A && git commit -m "content: classic papers batch <n>"`

### Task 26: 整体验收与上线

- [ ] **Step 1: 全量检查**：`uv run scripts/lint.py`（没有 error）；`uv run --with pytest --with pyyaml pytest scripts/tests -q`；`cd site && npm test && npm run e2e && npm run build && npx lhci autorun`，全部通过。
- [ ] **Step 2: 2,000 节点手测**：把 `synthIndex(2000)` 生成的图谱数据写到 `dist/data/graph.json`，`astro preview` 打开首页，用 Chrome DevTools Performance 录制：首屏可交互 ≤ 1.5 s，平移缩放时帧率稳定在 60 fps。结果截图存到 `docs/superpowers/perf/2026-11-graph-2000.png`，再恢复真实数据。
- [ ] **Step 3: 视觉走查**：亮色、深色两种模式下各截一张首页 L0、L1、L2 和一张论文页，与两张手绘稿对照（Agent 居中、主题环绕、水滴效果、左上和右上两张卡片），不一致的地方记下来交给用户。
- [ ] **Step 4: 上线前先问用户**：推送 main 会触发 Pages 部署，这一步对外可见，要用户确认后再推送。仓库 Settings → Pages 的 Source 需要设为 "GitHub Actions"，这一步由用户在网页上操作。
- [ ] **Step 5:** 部署后打开 `https://aleda.github.io/awesome-agent-llm-wiki/`，确认首页、一篇论文页、搜索可用。
