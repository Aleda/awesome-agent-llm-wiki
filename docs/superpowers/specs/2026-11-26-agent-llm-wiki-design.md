# Awesome Agent LLM Wiki — 设计文档

日期：2026-11-26 · 状态：待审

## 1. 意图

把头部实验室、工业界、学术界和 neolab 关于 agent 的研究和认知汇集到一个库里，由 LLM 按 Karpathy 的 LLM Wiki 模式增量维护。素材分四类：论文、技术或产品 blog、技术视频、podcast。

用户要的是两件事：
- **回顾快**：任何一份素材，读页首的两张卡片和「新认知」一节，就能想起它解决的本质问题、怎么做的、效果如何、提出了什么新看法。
- **串得起来**：同一个想法出现在不同素材里时，能看到谁提出、谁扩展、谁反驳；能从图谱一路钻进具体内容。

参照项目：`../ai-kol-wiki`（三层结构、Highlights、锚点溯源、lint 巡检）。本库沿用它的规范，扩展到四类素材，并换掉站点技术。

用户的两张手绘稿：[图谱首页](assets/sketch-graph-home.png)、[内容页](assets/sketch-content-page.png)。手绘稿里的要求都已写进 §7 和 §8；文字与手绘稿冲突时，以手绘稿为准，并回头修订本文档。

## 2. 目标、非目标、反目标

**目标**
- 四类素材各有模板；概念页作为跨素材的连接点。
- 首页是可缩放的知识图谱：Agent 居中，主题环绕；放大显示概念，再放大显示素材卡片，点击进入正文。
- 内容页：左上元信息卡、右上来源卡；正文里的内部链接、术语、引用锚点悬停显示批注卡，点击跳转。
- 中文全文搜索；图谱内节点即时搜索。
- 部署到 GitHub Pages；新效果以组件方式加入，不改框架。
- v1 要求：四个样例素材，加上用户指定"图谱里要有很多样例"后补录的经典论文（见 §11）。

**非目标（v1 不做）**
- 自动发现新素材（ai-kol-wiki 的 discover.py）。v1 由用户手动给链接。
- 论断卡（讨论中的方案 C）。
- 评论、登录、任何服务端。
- 内容页内嵌局部图谱（留作后续）。

**反目标（做出来也算失败）**
- 页面复述内容而没有判断：「新认知」写成了"他们聊了什么"。
- 图谱变成线团：缩小看不出结构，放大找不到东西。
- 概念页大量重复：同一个想法三个名字三页。
- 观点没有锚点，或锚点在原文里找不到。
- 加了效果之后内容页变慢。

## 3. 约束

- 纯静态站，部署到 GitHub Pages，base path 为 `/awesome-agent-llm-wiki/`。
- `wiki/` 下的 `.md` 在 GitHub 上直接可读：内部链接用相对路径 Markdown 链接，不用 `[[双链]]`。
- `sources/` 只增不改，勘误在 wiki 层处理。
- 性能预算（作为验收标准）：
  - 内容页：在 Starlight 自带脚本之外，本库新增的 JS ≤ 10 KB gzip（只有悬停卡片的脚本）；移动端 Lighthouse Performance ≥ 95。
  - 图谱页：JS ≤ 80 KB gzip（不含数据）；2,000 个节点时数据 ≤ 150 KB gzip；中档笔记本上首屏可交互 ≤ 1.5 s，平移缩放 60 fps。
  - 搜索：Pagefind 分片索引，打开搜索框时才加载。
  - 门槛的执行方式（我的决定）：JS 和数据体积由构建后的脚本检查，超标则 CI 失败；Lighthouse 在 CI 里对首页和三类样例页各跑一次，低于 95 则失败；图谱的首屏时间和帧率在发版前用本地造的 2,000 节点数据手工测一次，不进 CI。

## 4. 方案

| 方案 | 取舍 |
|---|---|
| mkdocs-material + 自定义 JS | 能复用 ai-kol-wiki 的流程；但即时导航会让自定义脚本重复初始化，搜索索引整份下载，效果越多越难维护 |
| Quartz | 自带悬停预览、反链、图谱；但图谱没有分档缩放，深改要 fork，上游升级难合并 |
| **Astro + Starlight（选定）** | 默认零 JS，交互组件按需加载；Starlight 提供导航、目录、深色模式和 Pagefind，可以替换组件而不 fork；frontmatter 用 zod schema 在构建期校验。代价是与 ai-kol-wiki 分成两套站点技术，v1 的搭建量略大 |

用户在了解三者的取舍后选定 Astro + Starlight（2026-11-26），理由是把扩展性和速度放在第一位。

## 5. 信息模型：三层加实体

用户选定方案 B：主题 → 概念 → 素材。

| 层 | 是什么 | 例子 | 图谱缩放档 |
|---|---|---|---|
| 根 | Agent | agent | 始终可见 |
| 主题 topic | 一个研究方向 | context、memory、rsi、continual-learning | L0 |
| 概念 concept | 有名字的设计或想法，可以被多个素材提出、扩展或反驳 | 上下文压缩、模型自管理上下文 | L1 |
| 素材 source | 一篇论文、blog、视频或播客 | arXiv 2611.05306 | L2 |
| 实体 entity | 机构或人 | Anthropic、NVIDIA、Jack Clark | 默认隐藏，可在过滤器里打开 |

实体页是我加的：来源卡里的作者、机构、嘉宾要能点进去，并能汇总"这个机构或这个人说过什么"。实体不进缩放层级，免得图谱变乱。

### 5.1 关系（边）

所有边都写在**发出方页面的 frontmatter** 里。构建时汇总所有边，自动生成反向链接，正文里不必重复写。

**自动生成的内容只在构建时注入，不回写 `.md`（我的决定）**。这包括反向链接、概念页「演化」、主题页「最近进展」、实体页的素材列表。「演化」每条的那句贡献说明写在发出方 relation 的 `note` 里，构建时拼进概念页，所以 LLM 只在一处维护。代价是在 GitHub 上看 `.md` 时没有这些自动段落，但 frontmatter 里的关系仍然可读。这样不需要"生成并回写"的脚本，也避免了生成内容和手写内容的合并冲突。

| rel | 方向 | 含义 |
|---|---|---|
| `proposes` | 素材 → 概念 | 首次提出 |
| `extends` | 素材 → 概念 | 在已有概念上改进 |
| `supports` | 素材 → 概念 | 提供证据，但不改设计 |
| `challenges` | 素材 → 概念 | 反驳或给出反例 |
| `applies` | 素材 → 概念 | 用到了，但不是它的贡献点 |
| `explains` | 素材 → 素材 | 讲解另一份素材（如视频讲论文） |
| `responds` | 素材 → 素材 | 明确回应或对比另一份素材 |
| `part-of` | 概念 → 主题，概念 → 概念 | 归属；一个概念可以属于多个主题 |
| `alternative-to` | 概念 ↔ 概念 | 解决同一问题的不同路线 |
| `by` | 素材 → 实体 | 作者、机构、嘉宾、主持（带 role） |

### 5.2 概念页的建立与去重

- **建页条件**：素材提出或明确命名了一个设计或想法，并且能回答"它解决什么问题"。产品名、模型名、benchmark 名不建概念页，放进术语表（§7.3）或实体页。
- **录入前先查重**：按 `title` 和 `aliases` 搜现有概念。同一个想法换了名字，就给旧页加 alias，再挂一条 `extends`，不新建页面。
- **成熟度**：只有一个素材支撑的概念标 `status: emerging`，有两个以上来源后改为 `established`。lint 不把 emerging 当作问题。
- **事后合并**：两个概念页后来发现是同一件事，就合并到较早的那页，旧 slug 留 `redirect_to`，构建时生成跳转。

## 6. 目录与 frontmatter

```
CLAUDE.md / AGENTS.md            # 本库规范（两份内容同步）
sources/                         # 原始资料，只增不改
  papers/<arxiv-id>/                   meta.yaml, anchors.md
  blogs/<org>/<YYYYMMDD>-<slug>/       meta.yaml, anchors.md
  videos/<channel>/<YYYYMMDD>-<id>/    transcript.md [, speakers.md]
  podcasts/<show>/<YYYYMMDD>-<id>/     transcript.md [, speakers.md]
  seen.txt, skipped.txt
wiki/                            # LLM 维护
  index.md, log.md, glossary.md
  topics/<slug>.md
  concepts/<slug>.md
  papers/<YYYYMM>-<slug>.md
  blogs/<YYYYMMDD>-<org>-<slug>.md
  videos/<YYYYMMDD>-<channel>-<slug>.md
  podcasts/<YYYYMMDD>-<show>-<slug>.md
  entities/<slug>.md
site/                            # Astro + Starlight 工程
scripts/                         # Python：fetch_*、lint.py（PEP 723 内联依赖，uv run）
.cache/                          # 论文和 blog 的全文缓存，加入 gitignore
```

**论文和 blog 的全文不进仓库（我的决定）**：论文和 blog 原文的版权归作者，公开仓库不宜整篇转存。全文抓到 `.cache/` 供 LLM 阅读，仓库只提交 `anchors.md`，内容是带编号的章节标题、图表标题，以及 wiki 实际引用到的短句原文。转录稿沿用 ai-kol-wiki 的做法，整篇提交。

### 6.1 公共字段（所有 wiki 页）

```yaml
title: You don't need long context
type: paper          # topic | concept | paper | blog | video | podcast | entity
summary: 一句话总结，≤ 60 字，悬停卡和图谱卡片都用它
topics: [context]    # 方向，显示在左上卡
aliases: []
added: 2026-11-26
```

### 6.2 素材页的额外字段

下面的关系值只是示例，实际关系要在录入时读完全文再定。

```yaml
date: 2026-11-03                       # 发表或发布日期
url: https://arxiv.org/abs/2611.05306
source_dir: sources/papers/2611.05306
venue: arXiv                           # 论文：会议或 arXiv；视频、播客：平台
duration: null                         # 视频、播客填分钟数
by:
  - { entity: nvidia, role: org }
  - { name: Peter Belcak, role: author }        # 没有实体页的人写 name
  - { name: 谷雨, role: guest, bio: NeoCognition 联创 }   # 播客示例
relations:
  - { concept: context-compaction, rel: proposes }
  - { concept: model-managed-context, rel: challenges, note: 一句话说明分歧点 }
  - { source: papers/2609-context-language-models, rel: explains }  # 视频示例
```

概念页的 `relations` 写 `part-of`（指向主题或上级概念）和 `alternative-to`；另加 `status: emerging | established`。主题页另加 `order`，用于控制图谱环上的顺序。

schema 写在 `site/src/content.config.ts`，按 `type` 区分必填字段。缺字段、`rel` 不在 §5.1 列表里、关系目标不存在，都直接构建失败。

## 7. 页面设计

### 7.1 页首两张卡片（所有素材页）

```
┌────────── 元信息卡 ──────────┐  ┌─────────── 来源卡 ───────────┐
│ 类型  论文 · 2026-11           │  │ 作者  Peter Belcak 等 12 人   │
│ 方向  context                  │  │ 机构  NVIDIA                  │
│ 出自  NVIDIA · arXiv           │  │ 发表  arXiv 2611.05306 · 31 页│
│ 相关  上下文压缩（提出）       │  │ 链接  原文 · 代码             │
│       模型自管理上下文（对照） │  │ 总结  （即 summary）          │
│       ← CLM 讲解视频（讲解）   │  └──────────────────────────────┘
└──────────────────────────────┘
```

- **左卡（元信息，概述）**：由 `type`、`date`、`topics`、`by` 里的机构、`relations` 和反向链接生成。"相关"一栏标注关系类型，最多显示 6 条，其余折叠。
- **右卡（来源，按类型不同）**：

| 类型 | 右卡字段 |
|---|---|
| 论文 | 作者、机构、发表（venue + id + 页数）、链接（原文、代码）、总结 |
| blog | 作者、机构、发布日期、链接、总结 |
| 视频 | 讲者或 UP 主、平台、时长、讲解对象（`explains` 的目标）、总结 |
| 播客 | 节目、主持、嘉宾（含身份）、时长、平台、总结 |

- 两张卡都由 frontmatter 生成，正文里不手写。宽屏时左右并排，窄屏时上下堆叠。
- 概念页和主题页用另一套卡：定义、所属主题、来源数和各关系类型的计数。

### 7.2 正文模板

所有素材页的第一节都是 **`## 新认知`**，规则沿用 ai-kol-wiki 的 Highlights：每条一句判断式的新看法，写"提出了什么"，不写"讲了什么"；3–10 条，最重要的 1–3 条加粗；每条带锚点，并链接到对应的概念页。读者只看两张卡片和这一节，就应该能完成回顾。

**论文**
1. `## 新认知`
2. `## 核心问题`：1–3 句。现有做法为什么不够；它本质上是什么问题（例如"是 X 问题的一个特例"）。
3. `## 核心洞察`：让设计成立的那个观察或假设，通常一两句。
4. `## 核心设计`：3–6 条机制，每条写"做什么，为什么这样做"；可以附一张图（Mermaid，或引用论文原图编号）。
5. `## 效果`：表格，列为 设置 / 基线 / 结果 / 锚点。只放支撑结论的数字，注明模型和 benchmark。
6. `## 局限与疑点`：分开写"作者承认的"和"本库判断的"。
7. `## 与其他工作的关系`：手写对比判断。关系列表由 frontmatter 自动生成在页尾，不手写。

**blog**
1. `## 新认知`
2. `## 核心论点`：作者想让读者接受的结论，一两句。
3. `## 论证与证据`：表格，列为 断言 / 数字 / 证据类型（内部数据、外部基准、推理、轶事）/ 锚点。
4. `## 立场`：谁在说，利益在哪。例如实验室在谈 RSI 的同时主张协调放缓。观点写成"Anthropic 认为……"，不写成事实。
5. `## 可验证的预测`：预测内容、到期时间、状态（待验证 / 已应验 / 已落空）。到期后由 lint 提醒回看。

**视频**（技术讲解类）
- 讲的是某篇论文时（有 `explains`）：论文内容写在论文页，视频页只写三节：`## 新认知`（讲者额外提出的）、`## 讲者的增量与偏差`（补充、类比、与原文不符之处）、`## 时间线`（按 `[HH:MM:SS]` 分段，每段一行要点）。这样论文摘要只维护一份。
- 不讲具体论文的视频：`## 新认知`、`## 核心观点`（按话题分小节）、`## 时间线`。

**播客**：沿用 ai-kol-wiki 视频页的结构。页首说明块（说话人映射、专名还原），然后是 `## 新认知`、`## 核心观点`（按话题分小节，带时间戳）、`## 分歧`（嘉宾与主持之间，或嘉宾之间）、`## 可验证的预测`。

**概念页**
1. `## 定义`：一句话定义，加上它解决什么问题。
2. `## 演化`：时间线，每条是"日期 · 素材 · 关系 · 一句话贡献"。骨架由 frontmatter 自动生成，LLM 补那一句话。
3. `## 设计空间`：解决同一问题的不同路线对比表。例如上下文管理：外部固定规则、频繁压缩、模型自管理。
4. `## 共识与分歧`
5. `## 开放问题`

**主题页**：`## 这个方向在解决什么`、`## 概念地图`（按子问题分组列出概念）、`## 关键争论`、`## 最近进展`（自动列出最近 10 份素材）。

**实体页**：一句话介绍，下面自动列出相关素材，以及每份素材新认知的第一条。

### 7.3 锚点、悬停批注与术语表

**锚点格式**（lint 逐处核验是否存在）

| 素材 | 写法 | 指向 |
|---|---|---|
| 视频、播客 | `（[00:12:03]）`，区间 `（[00:12:03]–[00:14:05]）` | 转录稿行首锚点，规则同 ai-kol-wiki |
| 论文 | `（§3.2）`、`（Fig. 4）`、`（Tab. 2）` | `anchors.md` 里的章节编号和图表编号 |
| blog | `（§2）`、`（§2¶3）` | `anchors.md` 里按顺序编号的章节和段落 |

信源声明沿用 ai-kol-wiki 的「来源：」行规则。素材页的锚点默认指向它自己的信源；概念页和主题页引用别处时，把链接写进锚点所在的括号。

**悬停批注**：正文里有三类元素可以悬停，点击则跳转。
- **内部链接**（指向任何 wiki 页）：卡片显示类型、标题、summary 和方向；目标是素材页时，再加上新认知的第一条。
- **术语链接**（指向 `glossary.md#<term>`）：显示术语定义。术语表收产品名、模型名、benchmark 和缩写（如 GRPO、BrowseComp-Plus、SGLang），每条一两句。它是普通 Markdown 链接，在 GitHub 上也能点。
- **锚点**：显示该处的原文片段。转录稿取锚点下约一分钟文本的前 200 字；论文和 blog 显示 `anchors.md` 里的标题或引用短句。点击跳到转录稿页的对应位置，或原文链接。

实现方式：构建时为每个可悬停目标生成一个小 JSON（`/previews/<id>.json`）；悬停 150 ms 后才请求，由浏览器缓存。内容页只加载这一段几 KB 的脚本。在触屏上改为点一下弹出、再点跳转。

## 8. 知识图谱（首页）

首页就是图谱，依据是手绘稿上写的"知识图谱：首页"。

### 8.1 数据与布局

构建时由脚本读取所有 wiki 页的 frontmatter，输出 `graph.json`：节点含 id、type、title、summary、topics、date 和预先算好的坐标；边含 source、target、rel。**布局在构建期用 d3-force 算好**（固定随机种子，结果稳定），浏览器不再现算：
- Agent 在中心，主题沿环分布；
- 概念聚在所属主题周围，属于多个主题的概念落在这些主题之间；
- 素材聚在与它关系最强的概念周围（`proposes` > `extends` > 其他）。

新增内容时，以上一版坐标作为初值，已有节点尽量不动，不打乱用户对位置的记忆。

### 8.2 分档缩放

| 档 | 可见内容 |
|---|---|
| L0 全局 | Agent 和主题大水滴，带名字和素材数；概念是不带字的小点；素材隐藏 |
| L1 方向 | 概念水滴带名字；素材是按类型着色的小点 |
| L2 细节 | 素材显示为迷你卡片：类型图标、标题、机构、日期、一行 summary |

档与档之间按缩放比例交叉淡入淡出，不跳变。点击主题或概念：平滑飞过去并放大到下一档，侧边弹出预览面板（summary、新认知前三条、"打开页面"按钮）。点击素材卡片：直接进入正文。

### 8.3 视觉

- 节点画成半透明水滴：径向渐变填充、一点高光、柔和投影；轮廓用少量控制点做缓慢形变，整体轻微漂浮。
- 按类型配色：主题、概念、论文、blog、视频、播客各一种颜色。这套颜色 token 和内容页卡片、悬停卡片共用，并有深色模式版本。具体色值留给实现者。
- 动画只跑视口内的节点；标签页不可见时暂停；系统开启 `prefers-reduced-motion` 时关闭形变和漂浮。
- 悬停节点时高亮它的邻居，边上显示关系类型（提出、扩展、反驳……），其余节点变淡。

### 8.4 交互与搜索

- 滚轮或双指缩放，拖动平移；键盘 `+`、`-`、`0` 也能操作。
- 过滤：素材类型、时间范围、关系类型、是否显示实体。
- 图谱内的搜索框：在已加载的节点标题、别名和 summary 上即时模糊匹配，支持中文；回车飞到该节点。没有结果时转到 Pagefind 全文搜索。拼音首字母匹配留到以后。
- URL 记录当前视图（如 `#node=concepts/context-compaction&z=2`），可以分享，也可以后退。
- 渲染用 Canvas 2D 自绘，用四叉树做命中测试和视口裁剪。节点数超过约 5,000 时再换 WebGL；渲染层留好接口，方便替换。

## 9. 站点实现要点

- 内容页用 Starlight 自带的侧边导航、页内目录、深色模式和 Pagefind 搜索。
- 两张卡片通过覆盖 Starlight 的 `PageTitle` 等组件注入。悬停卡片和图谱是独立组件，只在用到的页面加载脚本。
- frontmatter schema 用 `docsSchema({ extend })` 加 zod 定义（见 §6.2）。
- `wiki/` 和 `sources/` 放在仓库根目录，保证在 GitHub 上可读。让 Starlight 读到它们的方式留给实现者：可以让 content loader 指向根目录，也可以在构建前复制进 `site/src/content/docs`（与 ai-kol-wiki 拼装 `_docs` 的做法一致）。前提是相对链接在 GitHub 和站点上都能用。
- 一个 remark 插件负责两件事：把相对 `.md` 链接改写成站点路由；把锚点文本变成可悬停的链接。
- 转录稿渲染成页面，但不进侧边栏，也不进搜索索引（`data-pagefind-ignore`），控制索引体积。
- GitHub Actions 依次执行：`uv run scripts/lint.py` → `astro build`（含 Pagefind）→ `actions/upload-pages-artifact` → `actions/deploy-pages`。

## 10. 录入流程（写进本库的 CLAUDE.md）

| 类型 | 抓取 | 说明 |
|---|---|---|
| 论文 | `scripts/fetch_paper.py <arxiv-url>` | 用 arXiv API 取元数据；全文取 HTML 版，没有就取 PDF，存进 `.cache/`；生成 `anchors.md` 骨架（章节编号和标题、图表编号和标题） |
| blog | `scripts/fetch_blog.py <url>` | 正文抽取后存进 `.cache/`；`anchors.md` 按章节和段落编号 |
| 视频 | 复用 ai-kol-wiki 的 `fetch.py` | yt-dlp 支持 B 站；没有 CC 字幕时加 `--transcribe`，用 faster-whisper 本地转录 |
| 播客 | `scripts/fetch_podcast.py <url>` | 小宇宙的页面数据里有音频地址，下载后同样走 faster-whisper。yt-dlp 不支持小宇宙，抽取要自己写 |

**与 ai-kol-wiki 的关系（用户决定，2026-11-26）**：两个库各自独立抓取和转录，素材即使重复也不共用转录稿。v1 的样例播客在 ai-kol-wiki 里已经有一份（`sources/crossing/20261108-9J1iZuOUbx8`），新库仍然重新抓取，所以两边的时间戳锚点会不同。脚本代码可以参考或复制。

抓取之后：LLM 完整阅读 → 写素材页 → 为每个关系目标创建或更新概念页（先按 §5.2 查重）→ 更新主题页、实体页和术语表 → 更新 `index.md` → 在 `log.md` 追加一行 → 跑 lint。

**lint 检查项**：schema 和关系目标（构建期也会查）；锚点在信源里真实存在；孤儿页；概念别名冲突（疑似重复）；summary 超长；缺少「新认知」一节，或其中条目没有锚点；到期的预测。

**论文和 blog 锚点的两级核验（我的决定）**：CI 里只能查 wiki 引用的锚点是否在 `anchors.md` 里。本地跑 lint 时，如果 `.cache/` 里有全文，还要再查 `anchors.md` 的章节标题和引用短句是否逐字出现在全文中。录入流程要求本地 lint 通过后才能提交。往 `anchors.md` 追加新的引用短句属于"只增"，允许；修改或删除已有条目则不允许。

## 11. v1 样例

| 素材 | 预期连接 |
|---|---|
| 视频：B 站「Agent智能体深度研究院」讲 CLM（[BV1wd1wzkEU6](https://www.bilibili.com/video/BV1wd1wzkEU6/)，约 13 分钟，无 CC 字幕） | `explains` → CLM 论文页 |
| 论文：Context Language Models（CLM，[arXiv 2609.37725](https://arxiv.org/abs/2609.37725)，华盛顿大学 / Meta 超级智能实验室 / MIT / Trillium Labs，ICLR27） | 视频的讲解对象，补录 |
| 论文：You don't need long context（[arXiv 2611.05306](https://arxiv.org/abs/2611.05306)，NVIDIA，2026-11-03） | 与 CLM 同属 context 主题，路线对照 |
| blog：Anthropic《When AI builds itself》（Marina Favaro、Jack Clark，2026-09-18 更新，[链接](https://www.anthropic.com/institute/recursive-self-improvement)） | rsi 主题；含可验证的预测 |
| 播客：十字路口《年终复盘②》对话谷雨（NeoCognition 联创，2026-11-10，41 分钟，无文字稿，[链接](https://www.xiaoyuzhoufm.com/episode/6af00645b4a4e20202f67440)） | rsi、continual-learning、memory 等 |

CLM 论文是补录的。视频讲的就是它，有了这一页，"讲解视频 → 原论文"这条边才有落点。

v1 至少要建出：根节点 agent；主题 context、memory、rsi、continual-learning（与手绘稿一致）；素材里涉及的概念页（具体有哪些，读完全文后按 §5.2 判断，不预设）；涉及的实体页和术语。

### 11.1 补录的经典论文（用户决定，2026-11-26）

只有上面五份素材时图谱太稀，所以 v1 另外补录约 15 篇经典 agent 论文，全部按完整的论文模板写。下面是我拟的候选清单，覆盖四个主题，用户可以增删；arXiv 编号在录入时核对。

| 主题 | 论文 |
|---|---|
| agent 基础 | ReAct（2022）、Toolformer（2023）、SWE-agent（2024） |
| memory | Generative Agents（2023）、MemGPT（2023）、A-MEM（2025）、Mem0（2025） |
| context | Lost in the Middle（2023）、LLMLingua（2023）、ACE: Agentic Context Engineering（2025） |
| continual-learning | Voyager（2023）、Reflexion（2023） |
| rsi | STaR（2022）、Self-Rewarding Language Models（2024）、Darwin Gödel Machine（2025）、The AI Scientist（2024） |

这批论文也用来检验 §5.2 的概念去重规则。例如 MemGPT 的分层记忆、CLM 的模型自管理上下文、ACE 的上下文演化，应该落进同一张设计空间对比表，而不是各开一页互不相连。

## 12. 留给实现者

- 色板的具体色值、水滴形变参数、缩放档位阈值、力导布局参数。
- Starlight 读取根目录内容的方式（§9）。
- 抓取脚本的细节，以及能从 ai-kol-wiki 复制多少代码。

## 13. 我做的决定（审阅时请留意）

- 增加实体页，但不进图谱的缩放层级（§5）。
- 论文和 blog 的全文不进仓库，只提交 `anchors.md`（§6）。
- 关系只写在发出方的 frontmatter，反向链接自动生成（§5.1）。
- 视频讲论文时，论文内容只在论文页写一份（§7.2）。
- 补录 CLM 论文，作为第五份素材（§11）。
- 经典论文的候选清单（§11.1）。
- 首页即图谱（§8）。
- 性能预算的具体数字，以及哪些项进 CI（§3）。
- 自动生成的段落只在构建时注入，不回写 `.md`（§5.1）。
- 论文和 blog 的锚点做两级核验（§10）。
