# Awesome Agent LLM Wiki — 规范

本仓库按 [Karpathy 的 LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 运作：
把头部实验室、工业界、学术界和 neolab 关于 agent 的研究和认知，汇集成一个由 LLM 增量维护的结构化、互相链接的 Markdown 知识库。素材分四类：论文、技术或产品 blog、技术视频、podcast。

姊妹项目 [ai-kol-wiki](../ai-kol-wiki) 用同一套模式维护中美 AI KOL 的视频转录稿；两库**各自独立抓取和转录，不共用转录稿**，即使素材重复也各抓一份，时间戳锚点会不同。

## 三层结构加实体

| 层 | 位置 | 谁负责 |
|---|---|---|
| Raw Sources | `sources/` | 脚本抓取，**只增不改** |
| Wiki | `wiki/` | LLM 完全拥有，随新素材更新 |
| Schema | 本文件 + `site/src/content.config.ts` | 人来定规范，构建期校验 |

信息模型是**主题 → 概念 → 素材**三层，根节点 Agent 始终存在：

| 层 | 是什么 | 例子 | 图谱缩放档 |
|---|---|---|---|
| 根 | Agent | agent | 始终可见 |
| 主题 topic | 一个研究方向 | context、memory、rsi、continual-learning | L0 |
| 概念 concept | 有名字的设计或想法，可被多个素材提出、扩展或反驳 | 上下文压缩、模型自管理上下文 | L1 |
| 素材 source | 一篇论文、blog、视频或播客 | arXiv 2611.05306 | L2 |
| 实体 entity | 机构或人 | Anthropic、NVIDIA、Jack Clark | 不进缩放层级，默认隐藏，过滤器里打开 |

实体页让来源卡里的作者、机构、嘉宾可以点进去，汇总"这个机构或这个人说过什么"。

## 目录结构

```
CLAUDE.md / AGENTS.md            # 本库规范（两份内容同步，AGENTS.md 是 CLAUDE.md 的副本）
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
.cache/                          # 论文和 blog 的全文缓存，加入 .gitignore，不进仓库
```

**论文和 blog 的全文不进仓库**：版权归作者，公开仓库不宜整篇转存。全文抓到 `.cache/` 供 LLM 阅读，仓库只提交 `anchors.md`（带编号的章节标题、图表标题，以及 wiki 实际引用到的短句原文）。转录稿（视频、播客）沿用 ai-kol-wiki 的做法，整篇提交进 `sources/`。

**wiki 文件名**只允许 `^[a-z0-9][a-z0-9.-]*\.md$`（Starlight 会把 slug 转小写，大写或中文文件名会让链接失效）。

**内部链接**一律用相对路径 Markdown 链接，不用 `[[双链]]`，保证在 GitHub 上也能直接点开阅读。

## frontmatter 字段

### 公共字段（所有 wiki 页）

```yaml
title: You don't need long context
type: paper          # topic | concept | paper | blog | video | podcast | entity
summary: 一句话总结，≤ 60 字，悬停卡和图谱卡片都用它
topics: [context]    # 方向，显示在左上卡
aliases: []
added: 2026-11-26
```

### 素材页的额外字段

下面的关系值只是示例，实际关系要在录入时读完全文再定：

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

`wiki/index.md`、`wiki/log.md`、`wiki/glossary.md` 这三个库内说明页，frontmatter 只写：

```yaml
title: 索引
type: raw
```

（`type: raw` 表示原样展示、参与搜索，不走素材/概念/主题的卡片渲染和 schema 校验。）

schema 写在 `site/src/content.config.ts`，按 `type` 区分必填字段。缺字段、`rel` 不在下表之外的值、关系目标不存在，都会导致构建失败。

## 关系（边）

所有边都写在**发出方页面的 frontmatter** 里。构建时汇总所有边，自动生成反向链接，正文里不必重复写。

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
| `by` | 素材 → 实体 | 作者、机构、嘉宾、主持（带 role，单独成字段，不在 `rel` 枚举里） |

**自动生成的内容只在构建时注入，不回写 `.md`**：反向链接、概念页「演化」、主题页「最近进展」、实体页的素材列表都是如此。「演化」每条的那句贡献说明写在发出方 relation 的 `note` 里，构建时拼进概念页，所以 LLM 只在一处维护。代价是在 GitHub 上看 `.md` 时没有这些自动段落，但 frontmatter 里的关系仍然可读。

## 概念页的建立与去重

- **建页条件**：素材提出或明确命名了一个设计或想法，并且能回答"它解决什么问题"。产品名、模型名、benchmark 名不建概念页，放进术语表或实体页。
- **录入前先查重**：按 `title` 和 `aliases` 搜现有概念。同一个想法换了名字，就给旧页加 alias，再挂一条 `extends`，不新建页面。
- **成熟度**：只有一个素材支撑的概念标 `status: emerging`，有两个以上来源后改为 `established`。lint 不把 emerging 当作问题。
- **事后合并**：两个概念页后来发现是同一件事，就合并到较早的那页，旧 slug 留 `redirect_to`，构建时生成跳转。

## 页首两张卡片（所有素材页）

两张卡都由 frontmatter 生成，正文里不手写：

- **左卡（元信息，概述）**：由 `type`、`date`、`topics`、`by` 里的机构、`relations` 和反向链接生成。"相关"一栏标注关系类型，最多显示 6 条，其余折叠。
- **右卡（来源，按类型不同）**：

| 类型 | 右卡字段 |
|---|---|
| 论文 | 作者、机构、发表（venue + id + 页数）、链接（原文、代码）、总结 |
| blog | 作者、机构、发布日期、链接、总结 |
| 视频 | 讲者或 UP 主、平台、时长、讲解对象（`explains` 的目标）、总结 |
| 播客 | 节目、主持、嘉宾（含身份）、时长、平台、总结 |

概念页和主题页用另一套卡：概念页卡片为 定义、所属主题、来源数（含各关系计数）；主题页卡片为 定义、概念数、来源数。

## 正文模板

所有素材页的第一节都是 **`## 新认知`**：每条一句判断式的新看法，写"提出了什么"，不写"讲了什么"；3–10 条，最重要的 1–3 条加粗；每条带锚点，并链接到对应的概念页。读者只看两张卡片和这一节，就应该能完成回顾。

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
2. `## 演化`：时间线，每条是"日期 · 素材 · 关系 · 一句话贡献"。骨架由构建脚本自动生成，LLM 只需在发出方 relation 的 `note` 字段里写那一句话；**本节标题下留空**，内容在构建时注入，不手写、不回写 `.md`。
3. `## 设计空间`：解决同一问题的不同路线对比表。例如上下文管理：外部固定规则、频繁压缩、模型自管理。
4. `## 共识与分歧`
5. `## 开放问题`

**主题页**：`## 这个方向在解决什么`、`## 概念地图`（按子问题分组列出概念）、`## 关键争论`、`## 最近进展`（**本节标题下留空**，构建时自动列出最近 10 份素材，不手写）。

**实体页**：一句话介绍，下面自动列出相关素材，以及每份素材新认知的第一条（构建时生成）。

## 锚点、引用与术语表

### 锚点格式（lint 逐处核验是否存在）

锚点只在**全角括号 （…） 内**才会被站点识别为可悬停的引用；半角括号 `(...)` 里的同样文字只是普通文本。

| 素材 | 写法 | 指向 |
|---|---|---|
| 视频、播客 | `（[00:12:03]）`，区间 `（[00:12:03]–[00:14:05]）` | 转录稿行首锚点（时间戳保留方括号），规则同 ai-kol-wiki |
| 论文 | `（§3.2）`、`（Fig. 4）`、`（Tab. 2）` | `anchors.md` 里的章节编号和图表编号 |
| blog | `（§2）`、`（§2¶3）` | `anchors.md` 里按顺序编号的章节和段落 |

信源声明沿用「来源：」行规则（见下方「写作约定」）。素材页的锚点默认指向它自己的信源；概念页和主题页引用别处素材时，把目标页链接和锚点写进同一对全角括号里：

```
（[视频页](../videos/x.md) [00:01:02]）
```

时间戳部分仍保留方括号；链接写在括号外的，锚点会被算到本节「来源：」声明的信源上，而不是链接指向的那份素材。

### anchors.md 格式（论文、blog）

```
## §3.2 <小节标题>
- Fig. 4 — <图说明>
- Tab. 2 — <表说明>
- §3.2¶1: "<wiki 实际引用到的短句原文，逐字抄录>"
```

即：`## §<编号> <标题>` 标出章节；`- Fig. <n> — <说明>`、`- Tab. <n> — <说明>` 标出图表；`- §<编号>[¶<n>]: "<短句>"` 记录被 wiki 引用过的原文短句，供两级核验用。`anchors.md` 只允许追加，不允许修改或删除已有条目。

### 术语表（`wiki/glossary.md`）

每条格式：

```
## <术语>

一两句定义。
```

术语表收产品名、模型名、benchmark 和缩写（如 GRPO、BrowseComp-Plus、SGLang）。正文里链接术语用普通 Markdown 链接：

```
[术语](../glossary.md#<slug>)
```

`slug` 就是站点（Starlight）和 GitHub 给这个 `## <术语>` 标题生成的锚点 id，算法同 github-slugger：把术语转小写，删掉字母、数字、空格和 `-` 以外的所有字符（如 `'`、`.`、`/`、括号），再把每个空格换成 `-`；不合并连续的 `-`，也不去首尾。例如 `BrowseComp-Plus` → `browsecomp-plus`，`GRPO` → `grpo`，`Amdahl's law` → `amdahls-law`，`Claude Opus 5.5` → `claude-opus-55`。这是普通 Markdown 锚点链接，在 GitHub 上也能直接点开跳转。lint 会核对每个 `glossary.md#<slug>` 都对得上术语表里的一个标题。

## 悬停批注

正文里有三类元素可以悬停，点击则跳转（悬停 150 ms 后才请求预览数据）：
- **内部链接**（指向任何 wiki 页）：卡片显示类型、标题、summary 和方向；目标是素材页时，再加上新认知的第一条。
- **术语链接**（指向 `glossary.md#<slug>`）：显示术语定义。
- **锚点**：显示该处的原文片段。转录稿取锚点下约一分钟文本的前 200 字；论文和 blog 显示 `anchors.md` 里的标题或引用短句。点击跳到转录稿页的对应位置，或原文链接。

## 录入流程

| 类型 | 抓取 | 说明 |
|---|---|---|
| 论文 | `scripts/fetch_paper.py <arxiv-url>` | 用 arXiv API 取元数据；全文取 HTML 版，没有就取 PDF，存进 `.cache/`；生成 `anchors.md` 骨架（章节编号和标题、图表编号和标题） |
| blog | `scripts/fetch_blog.py <url>` | 正文抽取后存进 `.cache/`；`anchors.md` 按章节和段落编号 |
| 视频 | `scripts/fetch_video.py <url>`（复用/参考 ai-kol-wiki 的 `fetch.py`） | yt-dlp 支持 B 站；没有 CC 字幕时加 `--transcribe`，用 faster-whisper 本地转录 |
| 播客 | `scripts/fetch_podcast.py <url>` | 小宇宙的页面数据里有音频地址，下载后同样走 faster-whisper。yt-dlp 不支持小宇宙，抽取要自己写 |

**与 ai-kol-wiki 的关系**：两库各自独立抓取和转录，素材即使重复也不共用转录稿，两边的时间戳锚点会不同。脚本代码可以参考或复制 ai-kol-wiki 的实现，但不共享产物。

抓取之后，六步走完才算入库完成：
1. **完整阅读**抓取到的素材（全文或转录稿）。
2. 写素材页（两张卡片由 frontmatter 生成 + 对应类型的正文模板）。
3. 为每个关系目标创建或更新概念页（先按「概念页的建立与去重」查重）。
4. 更新主题页、实体页和术语表。
5. 更新 `wiki/index.md`。
6. 在 `wiki/log.md` 追加一行，跑 lint。

**lint 检查项**（`scripts/lint.py`，详见「脚本命令」）：
- schema 和关系目标是否存在（构建期也会查一次）；
- 正文里的相对 `.md` 链接（跟随 `redirect_to` 后）是否指向存在的 wiki 页或 `sources/` 下存在的文件，`glossary.md#<slug>` 是否对得上术语标题；
- 锚点在信源里是否真实存在；
- 孤儿页（没有任何关系或反链指向的页面）；
- 概念别名冲突（疑似重复概念）；
- `summary` 超长（> 60 字）；
- 缺少「新认知」一节，或其中条目没有锚点；「新认知」条目不止一句（warn：（…）和引号之外、条目末尾之前出现 。！？）；
- 到期的预测（blog 页「可验证的预测」里到期未回看的条目）。

**论文和 blog 锚点的两级核验**：
- CI 里只能查 wiki 实际引用的锚点是否在对应的 `anchors.md` 里登记（不接触 `.cache/`，因为 `.cache/` 不进仓库）。
- 本地跑 lint 时，如果 `.cache/` 里有全文缓存，还要再查 `anchors.md` 里的章节标题和引用短句是否逐字出现在全文中，确认 `anchors.md` 没有抄错或过时。
- 录入流程要求**本地 lint 通过后才能提交**。往 `anchors.md` 追加新的引用短句属于"只增"，允许；修改或删除已有条目则不允许——发现错误时另起一条新引用，不改旧的。
- `sources/seen.txt` 和 `sources/skipped.txt` 遵守同样的只追加规则：只能在末尾加行，不能改动或删除已有行。lint 对这三类文件都做检查。

## 脚本命令

`scripts/fetch_paper.py`（arXiv Atom API 取元数据；全文先取 arXiv HTML 版，404 时回退 `v1`，两者都不可用再回退到 PDF 版用 pypdf 抽取文本；`anchors.md` 的章节、图、表编号自动生成）：

```bash
uv run scripts/fetch_paper.py <arxiv-url-or-id>
uv run scripts/fetch_paper.py 2611.05306
uv run scripts/fetch_paper.py https://arxiv.org/abs/2611.05306
```

`scripts/fetch_blog.py`（trafilatura 抽正文和元数据；`anchors.md` 按章节编号，`meta.yaml`/`.cache/` 全文里的正文按 `§n¶m` 编号；`--org` 是机构 slug，如 `anthropic`）：

```bash
uv run scripts/fetch_blog.py <url> --org <slug>
uv run scripts/fetch_blog.py <url> --org <slug> --date 2026-09-18   # 页面元数据没有发布日期时必填
```

`scripts/fetch_video.py`（yt-dlp 取元数据 + CC 字幕；B 站用 BV 号做 `<id>`；无字幕时加 `--transcribe` 本地转录，转录引擎默认按平台自动选择——macOS arm64 用 mlx-whisper，其余用 faster-whisper，需要用 `--with` 按需注入，见下）：

```bash
uv run scripts/fetch_video.py <video-url> --channel <slug>                 # 有 CC 字幕
uv run --with mlx-whisper scripts/fetch_video.py <url> --channel <slug> --transcribe      # macOS，无字幕
uv run --with faster-whisper scripts/fetch_video.py <url> --channel <slug> --transcribe   # Linux/CUDA，无字幕
```

`scripts/fetch_podcast.py`（小宇宙单集页面无公开 API，从 `<script id="__NEXT_DATA__">` 取单集数据，音频下载后本地转录；yt-dlp 不支持小宇宙）：

```bash
uv run --with mlx-whisper scripts/fetch_podcast.py <episode-url> --show <slug>
uv run --with faster-whisper scripts/fetch_podcast.py <episode-url> --show <slug> --engine faster
```

两者都支持 `--force`（覆盖已存在的 `transcript.md`，只用于从未提交过的转录稿；`sources/` 本来只增不改）和 `--keep-audio`（转录成功后保留下载的音频，默认会删除）。

`scripts/lint.py`（PEP 723 内联依赖，`uv` 自动安装）：

```bash
uv run scripts/lint.py          # 本地跑全部检查，.cache/ 有全文缓存时还会核验 anchors.md
uv run scripts/lint.py --ci     # CI 用，跳过 .cache/ 全文核验（CI 不拉取全文）
uv run scripts/lint.py --ci --base <ref>   # sources/ 只增不改检查改为和 <ref> 比，而不是和 HEAD 比
```

有 error 级问题时退出码为 1（warn 不影响退出码）。CI（`.github/workflows/pages.yml`）在构建前自动跑 `uv run scripts/lint.py --ci --base <push 前的提交>`；CI 里工作区等于 HEAD，不传 `--base` 时只增不改检查查不出已提交的改动。拿不到 push 前的提交时退回 `origin/main`，再没有就不传。

## 写作约定

- **每个素材页都要有 `## 新认知`**：放在页首两张卡片之后、第一个正文小节之前。
  - 它是整份素材的**认知级总结**：读者只看这一节，就能想起这份素材的立意和对自己的启发（TL;DR）。
  - 每条一句**判断式的新认知**，写"提出了什么新的看法"，不写"讲了什么"、不复述流程。
  - 3–10 条；最重要的 1–3 条整句**加粗**，作为一眼可扫的重点。
  - 每条末尾带锚点（规则同上），`## 新认知` 不豁免溯源要求。
  - 嘉宾与主持人（或几位作者/嘉宾之间）有明显分歧时，单列一条写出另一方的保留意见。

- **观点必须可溯源**：wiki 中每条实质性观点后面标锚点，格式见「锚点格式」一节。
- **信源要写成链接，不能只写在标题文字里**：一个小节的引用若只写锚点、不逐条带目标页链接，就在小节标题下紧跟一行 `来源：[机构 / 主体](../papers/xxx.md)`（多个素材用顿号并列）。
  - 「来源：」行管到下一条「来源：」行为止，`###` 子小节不声明就沿用上层；所以**换了素材的小节必须重新声明**，否则会继承上一节的信源。
  - 标题里的"（NVIDIA，2026-11）"、括号里的 `[00:06:12]` 若没有配套的链接，都不算声明——读者点不过去，lint 也认不出。
  - 同一行引用别的素材时（交叉引用、对照），把链接放进锚点所在的括号里：`（[视频页](../videos/x.md) [00:01:02]）`；链接写在括号外的，锚点会被算到本节声明的信源上。
  - 一个小节混用多份素材、且逐条都能带行内链接时，可以不写「来源：」行。
  - 整页只链接一份素材的页面不必写（默认就是它）；素材页默认信源就是它自己对应的 `sources/`。
  - `scripts/lint.py` 按这套规则逐处核验：锚点不是信源里的锚点报错，找不到信源也报错。
- **时间戳必须照抄转录稿锚点**，写成 `（[HH:MM:SS]）` 或区间 `（[HH:MM:SS]–[HH:MM:SS]）`：
  - 只能用 `transcript.md` 里**真实存在**的 `[HH:MM:SS]` 行首锚点，逐字复制。不要自己心算、取整或插值。
  - **一律写满 `HH:MM:SS`**，不写 `HH:MM`，更不写 `MM:SS`。这两种缩写彼此无法区分，容易把引用全部误算到同一时间点。
  - ⚠️ **锚点不代表秒级精度**：锚点间隔约一分钟，一个锚点标注的是一整块文本，不是说这条观点精确出现在那一秒。
  - 若某处内容超出转录稿结尾，保留粗略写法并注明，不要硬套到最近的锚点上——宁可粗，也不要假精确。
- **论文、blog 锚点同样要逐字核实**：`§`、`Fig.`、`Tab.` 编号必须是 `anchors.md` 里登记过的，不要凭记忆编号。
- **区分转述与断言**：作者或讲者的观点写成"X 认为…"，不要写成客观事实。
- **概念页是跨素材的连接点**：同一个想法出现在不同素材里，优先复用已有概念页（见「概念页的建立与去重」），不要为措辞不同的同一想法另开一页。
- 所有面向用户的文案用中文；专有名词、术语保留英文原文。
- 时间一律写绝对日期（如 2026-11），不写"最近""上个月"。
- `sources/` 下的文件一旦写入不再修改；勘误在 wiki 层处理。
