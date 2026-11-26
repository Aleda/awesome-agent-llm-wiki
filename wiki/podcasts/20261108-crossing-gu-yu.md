---
title: "【年终复盘②】RSI可能是NeoLab的机会、PA真的有用、创业要造灭火器还是砖头？｜对话谷雨"
type: podcast
summary: NeoCognition 联创谷雨复盘 2026：RSI 是 NeoLab 的机会，记忆笔记式持续学习的上限被低估
topics: [rsi, continual-learning, memory]
aliases: [十字路口 年终复盘② 谷雨, Crossing Gu Yu]
added: 2026-11-27
date: 2026-11-08
url: https://www.xiaoyuzhoufm.com/episode/6af00645b4a4e20202f67440
source_dir: sources/podcasts/crossing/20261108-6af00645b4a4e20202f67440
venue: 小宇宙
duration: 41
show: 十字路口 Crossing
by:
  - { name: Koji（杨远骋）, role: host }
  - { name: 谷雨, role: guest, bio: NeoCognition 联合创始人 }
relations:
  - { concept: automated-ai-research, rel: supports, note: 从产业格局补一个推论：AI 写训练 infra 和 recipe 的能力超过人之后，头部实验室积累的 infra 会成为负担，从零开始的 NeoLab 可能加速更快 }
  - { concept: memory-notes, rel: supports, note: 认为改写记忆笔记做持续学习仍不是可靠的优化算法，但上限受模型能力限制，可以靠教模型写笔记的训练数据提高，截至 2026-11 只有 Anthropic 和 OpenAI 做得好 }
  - { concept: streaming-task-evaluation, rel: extends, note: 介绍 NeoCognition 未公开的 Apprentice Bench：100 道建筑行业会计任务按顺序连续做，后面的题要用到前面学到的公司规则；主张长程应理解为员工从菜鸟变成老员工的过程 }
---

> **说话人映射**：转录稿由 mlx-whisper 自动生成，没有说话人标签，本页按内容判断归属。提问、串场、报"第几个 aha moment"的是主持人 Koji（杨远骋）；回答问题、讲 NeoCognition 和自己经历的是嘉宾谷雨。依据是开场主持人介绍嘉宾的公司、融资和团队（[00:00:00]），结尾主持人致谢谷雨、谷雨回谢"Koji 老师"（[00:39:45]）。下面几段归属不确定，正文引用时注明：数学"解题过程比结果重要"和拼豆自习室两段，较可能是 Koji（[00:14:16]–[00:15:17]）；"情绪价值短期内难被取代"和减肥药收入一段（[00:22:24]）；"不能 bluff、说了要能 deliver"一句，较可能是 Koji（[00:29:32]）；科幻小说一段（[00:34:39]），讲完后的 NeoCognition 植入应是谷雨，"植入也太丝滑了"应是 Koji；AI 短剧剧本报价一段，较可能是 Koji（[00:35:41]）；"未来人只需要审美和美"一句，较可能是谷雨（[00:35:41]）。
>
> **专名还原**（转录原文 → 本页写法，未列出的按原文；转录稿本身不改）：
>
> - 谷宇、古语 → 谷雨；古基老师 → Koji 老师；Neo Co-Cognition → NeoCognition；"可以关注你要考虑后续的工作"中的"你要考虑"（[00:34:39]，疑为 NeoCognition）
> - Cognitive Learning、Conding Learning、cundate learning、continue learning、New Learning → continual learning；持育学习、持续学业 → 持续学习
> - Neo Lab、Neolab、new lab → NeoLab；阿赛公司 → RSI 公司
> - Compute Use → Computer Use；OPS5.5 → Opus 5.5（节目简介写作 Opus 5.5）；Reuseable Skill → reusable skill；PIPELINE → pipeline
> - non-horizon、长城 → long horizon、长程；一件Benchmark → agent benchmark；e井 → agent
> - opai、OpenA → OpenAI；enshovy、Enthlop → Anthropic；cloud → Claude；cloud code → Claude Code；Gimini → Gemini；XGPT、chagpt → ChatGPT；Bentice（[00:09:14]、[00:10:14]，疑为 Anthropic）
> - mind2web → Mind2Web；onlinemind2web → Online-Mind2Web；agent bench → AgentBench；多么泰 → 多模态；苏玉老师 → 苏煜（Yu Su，按 OSU NLP 组和 Mind2Web 推断）
> - link → Lean；imo → IMO；ASLOP → AI slop；省过稿 → 审过稿；LNA进的时代 → LLM agent 的时代
> - 总值轮、种资论 → 种子轮；识医生 → 实习生；tubillion dollar四股指 → 20 亿美元估值（疑为 two billion dollar 的估值）
> - X教授 → 大学教授；南模 → 男模；树商……杀 → 厂商……刷；分入 → 分数；前几年问题（疑为"开放问题"，所指不确定）
> - 拼斗自习室 → 拼豆自习室；林真英 → 林正英；AI视频深沉 → AI 视频生成；赚利 → 算力；情欲价值 → 情绪价值
> - Personal aging → personal agent；绘画 → 会话；open cloud（疑为 OpenClaw）；智慧单位 → 周为单位；微信language → vision language
> - 无法确认、保留原文：Recursive、Mirandio、Gifty and Discovery Loop（谷雨看好的 RSI 公司）；K3（疑为 Kimi K3，无法确认）、Ogane（所指公司不明）；scorecentering（某项训练技巧）；muse、instinct（谷雨在用的 personal agent 产品）；ungrounded（谷雨联合发起的播客）
> - 开头"请不吝点赞 订阅 转发 打赏支持明镜与点点栏目"是 whisper 常见的幻觉文本，可忽略（[00:00:00]）
>
> **阅读边界**：谷雨的公司 NeoCognition 做 continual learning（[00:00:00]），本期关于 continual learning 的判断、对 Apprentice Bench 的介绍和"明年的关键词是 continual learning"的预测，都与公司利益一致。Apprentice Bench 没有公开（[00:12:15]），分数和设计只有谷雨的口述。种子轮 4,000 万美元、17 名全职员工加 4 名实习生是自报数字（[00:00:00]），未经核实。

## 新认知

- **谷雨认为 AI 写训练 infra 和 recipe 的能力超过人之后，头部模型公司积累的 infra 和 recipe 会变成负担，从零开始的 NeoLab 能让 AI 随时重搜、随时丢弃，可能加速更快，所以 RSI 是 NeoLab 的机会（[00:02:04]–[00:03:05]）**，见[自动化 AI 研究](../concepts/automated-ai-research.md#共识与分歧)。
- **谷雨认为真正的长程是一个员工从菜鸟变成老员工的几个月到一两年，所以评测应把前后依赖的任务连成一条流让 agent 边做边学，单个要做半天的难题既难找又难扩展（[00:08:13]–[00:09:14]）**，见[连续任务流评测](../concepts/streaming-task-evaluation.md)。
- **谷雨修正了自己 2026 上半年的判断：改写记忆笔记做 continual learning 仍不是可靠的优化算法，但它的上限主要受模型能力限制，模型变强后上限可观（[00:16:18]–[00:17:18]）**，见[记忆笔记](../concepts/memory-notes.md)。
- 谷雨认为 continual learning 能力是区分前沿模型和非前沿模型的维度，提升它最需要教模型写好记忆笔记的数据，而截至 2026-11 只有 Anthropic 和 OpenAI 做得好（[00:11:14]、[00:17:18]），见[记忆笔记](../concepts/memory-notes.md#共识与分歧)。
- 谷雨认为 Computer Use 的操作层面在 2025 年底到 2026 年初基本解决，靠的是 coding 训练规模带来的泛化，剩下的难点是 agent 不了解每家公司自己的业务流程这类认知问题，他说这正是 NeoCognition 在做的（[00:04:05]–[00:05:08]），对应 [Continual Learning](../topics/continual-learning.md) 方向。
- 谷雨认为一批数学难题（转录作"前几年问题"，所指不确定）被 informal 方法接连解决，说明不靠 Lean 一类形式化系统提供信号也能走得很远，他 2024 年"模型评判自己是左脚踩右脚"的判断低估了 scaling（[00:13:16]–[00:14:16]），对应 [RSI](../topics/rsi.md#关键争论) 里的评测器瓶颈之争。
- 谷雨认为 personal agent 在 2026 年变得有用主要靠产品设计，即一个持续存在的单一会话加拟人化形象，proactiveness 本身不是新技术（[00:36:42]–[00:37:43]），对应 [Memory](../topics/memory.md) 方向的跨会话连续性。

## 核心观点

### RSI 是 NeoLab 的机会

- [NeoLab](../glossary.md#neolab) 是谷雨对 NeoCognition 这类研究型创业公司的归类（[00:00:00]）。
- 谷雨说他约 2026-10 还不理解（原话"上个月"，按节目发布日 2026-11-08 推算）为什么有创业公司做 RSI，Recursive 和 Mirandio 的发布改变了他的看法（[00:01:01]）。
- 他原来的理由有两条：RSI 本质上是模型叙事，要追最前沿的模型厂，连其他大模型厂都还在追；RSI 要有起点，起点就得有自己的模型（[00:01:01]–[00:02:04]）。
- 改变看法的依据是一则他转述的案例：Mirandio 一个人用三个多月训出的预训练模型比 K3 还强（[00:02:04]）。这个说法本库无法核实，K3 所指的模型也无法确认。
- 谷雨认为 AI 的研发能力越来越强，可以想象它写 training infra 和 training recipe 的能力超过人；到那时，大模型公司积累的 infra 和 recipe 反而可能成为累赘（[00:02:04]）。
- 他举了国内一家模型厂朋友的例子：某项技巧大家都知道能提一两个点，但要适配自家 infra 代价太大，所以不用；从零开始的 startup 没有这个负担，可以让 AI 搜一套新 recipe、搭一套新 infra，随时迭代、随时丢掉（[00:03:05]）。
- Koji 追问 NeoLab 是否仍要融到更多钱才有卡和数据，谷雨同意：走模型路线、做 full stack 训练肯定需要大量的钱，Recursive 和 Mirandio 都拿了很多钱（[00:03:05]–[00:04:05]）。他还看好 Gifty and Discovery Loop 等公司，国内的同类公司还要再观察（[00:04:05]）。

### Computer Use：操作层面基本解决

- 谷雨说 2025 年大家还在讨论 Computer Use 的泛化性和可靠性，2025 年底到 2026 年初，操作层面的问题基本解决；他认为主要原因是 coding 训练规模上去了，能力泛化到软件和网页操作（[00:04:05]）。
- 他认为下一步是认知层面的问题：agent 知道该怎么处理一件事时操作完全能做对，难点在于它不知道每家公司内部的业务流程；这一层与 Computer Use 正交，但最后要落到软件和网页操作上（[00:05:08]）。
- NeoCognition 成立初期花了几个月解决操作层面的可靠性：让 agent 做几次，挑出做对的那次封装成 reusable skill，为此搭了一条 pipeline；谷雨说现在让 [Claude Opus 5.5](../glossary.md#claude-opus-5-5) 自己实现这套流程很快，而且它会自己纠错（[00:06:08]）。这对应 [Continual Learning](../topics/continual-learning.md#关键争论) 里"积累的技能换了底座模型还有多少用"的问题。

### Apprentice Bench 与连续任务评测

- 谷雨说模型部署后在生产中持续迭代自己，现在没有现成的 benchmark 能评估，所以 NeoCognition 定义了 [Apprentice Bench](../glossary.md#apprentice-bench)（[00:06:08]–[00:07:10]）。
- 设计（谷雨口述）：100 道建筑行业的会计报账题，每道题涉及公司特有的 convention、workflow 和审批流程；100 道题不独立，要 in a stream 按顺序连着做，后面的题要用到前面题目的反馈和学到的知识（[00:07:10]–[00:08:13]）。见[连续任务流评测](../concepts/streaming-task-evaluation.md)。
- 谷雨批评现有自称 long horizon 的 agent benchmark 偏向找"一个人要做半天"的难题：这类任务难找，也难 scale up（[00:08:13]）。他认为长程 scale up 的终点是 lifelong intelligence，要能边干边学（[00:08:13]–[00:09:14]）。
- 分数（谷雨口述）：第一版上最强的 Claude 模型大约 80 分；很快会发新版本，最强模型的分数会低很多（[00:10:14]–[00:11:14]）。
- 谷雨认为这个 benchmark 不容易刷分：一是数据没有公开，厂商没法追着刷；二是它测的是持续学习这种 meta level 能力，只针对这家公司的规则把报账做好对模型没有意义（[00:12:15]）。
- 背景：谷雨说他所在的 OSU NLP 组此前发过 MMMU、[Mind2Web](../glossary.md#mind2web)（他说 2023-05 发布）、Online-Mind2Web，并和清华合作过 AgentBench（[00:09:14]–[00:10:14]）。

### 记忆笔记与 continual learning

- 谷雨说他 2026 上半年到处讲，用改写 Memory Notes 的方式做 continual learning 不靠谱，理由是它不是一个 reliable 的 optimization algorithm（[00:16:18]）。
- 他现在认为这个方式的上限被低估了：它仍不是可靠的优化算法，但他之前认为的主要问题是写笔记的质量被模型自身能力卡住，模型越来越强后，上限可能相当可观（[00:16:18]–[00:17:18]）。见[记忆笔记](../concepts/memory-notes.md)。
- 谷雨认为 continual learning 是区分前沿和非前沿模型的维度；最重要的数据是让模型更好地写 memory notes 的数据（[00:11:14]）。
- 他听说 OpenAI 和 Anthropic 各有自己的 recipe，并猜测 Claude Code、Codex 这类 long session 天然带有这种数据；他认为这套 recipe 还不成熟，其他 model lab 没有特别好的数据（[00:11:14]）。他说截至节目录制，这方面真正强的只有 Anthropic 和 OpenAI（[00:17:18]）。

### Scaling 与数学

- 谷雨说 2024 年他和很多人认为数学能做成是因为有 Lean 这类形式化验证系统提供信号，否则让 LLM 评判自己有点左脚踩右脚，上限不会高；结果 2025 年已经能用 informal 的方式拿到 IMO 金牌，2026 年一批数学难题（转录作"前几年问题"，所指不确定）被接连解决（[00:13:16]–[00:14:16]）。
- 他把这看作又一次 bitter lesson：应该相信 scaling 能解决更多问题（[00:14:16]）。
- 两人都理解一些数学家因此陷入虚无主义（[00:14:16]）。随后有人提出解题过程中积累的方法和 know-how 比解题本身重要，数学以后可能像棋类一样成为人挑战自己智力极限的活动（说话人不确定，较可能是 Koji）（[00:14:16]–[00:15:17]）。

### 学术会议体系

- 谷雨认为 2023 年就有苗头，到 2026 年投稿、评审和会议体系"彻底崩塌"（[00:17:18]）。他说自己已经一年半没投论文，半年多没审稿、没当 AC；原因是大量 AI slop，一个 batch 16 篇里拿得出手的也许只有一两篇，论文数量和能力已经几乎没有相关性（[00:18:19]）。
- NeoCognition 招毕业生时更看面谈和 research presentation，看逻辑表达、QA 反应和对问题的理解（[00:18:19]–[00:19:21]）。
- 谷雨认为学术评估最好的方式是同行评议，但评议者要有足够高的 taste，类似美国院系招人时 senior professor 听 job talk；现在会议审稿人没有门槛（[00:19:21]–[00:20:22]）。
- 他认为新体系的建立有滞后，中美学术圈仍按惯性运转；AI 方向的人进大学当教职的优先级在下降，因为去 frontier lab 或 NeoLab 收入高得多，学校资源也少（[00:20:22]）。

### 智力贬值与社会地位

- 谷雨说他真的认为十年后大学教授的社会地位可能不如夜店男模：智力不再值钱时，长相和身材更值钱；现代文明之前体力更值钱，机械时代让体力变得不重要，AI 是数字世界的机械（[00:21:23]–[00:22:24]）。
- 情绪价值短期内机器难以取代、全球两种最畅销减肥药的收入大于模型公司收入，这两句说话人不确定（[00:22:24]）。
- 被问到 PhD 是否还值得读，谷雨不给建议："想读就可以"；Koji 追问"想"的背后是否要分析原因，谷雨坚持只要真的想就行（[00:22:24]–[00:23:26]）。
- 一段 AI 短剧剧本的报价：2025 年 60 分钟剧本约 7 万元人民币，现在 AI 一天能写 100 个（说话人不确定，较可能是 Koji）（[00:35:41]）。随后有人说未来人只需要两样东西：审美，即决定正确的方向；美，即情绪价值（说话人不确定，较可能是谷雨）（[00:35:41]）。

### 创业：灭火器还是砖头

- 谷雨说自己从没想过去大厂，创业的原因是需要时间上的灵活性、对方向的 ownership，以及对风险"没有任何概念"；父母对他没有世俗层面的要求（[00:23:26]–[00:25:27]）。
- 谷雨说导师苏煜带领的组在学术界以 vision 和 taste 著称，从不"拿锤子找钉子"；但创业后他们反而成了 solutions in search of problems（SISP）的人（[00:25:27]–[00:26:29]）。他的解释：学术研究在一套技术体系内能自洽闭环就行，创业要和市场一起闭环，要想清楚 fundamental problem 能解决谁的什么问题、带来什么商业价值（[00:26:29]）。他说 continual learning 是 AI 的 fundamental problem，但它在产品里应该是什么形式，是团队创业以来（截至 2026-11 约一年）交的学费（[00:27:31]）。
- 谷雨认为他们这支学术出身的团队对发布的标准太高，用 YC 的比喻说，灭火器造出来之前，卖砖头的人已经卖出 100 块（[00:28:32]）。
- 谷雨引用的 YC 说法原意是：头上着火的人不会等一盆水或一个灭火器，手边有砖头就会拿砖头把火拍灭；他说团队对发布的标准太高，总想发一个特别满意、特别 solid 的东西，公司层面有时应该先发不成熟的东西把闭环跑起来，"甚至有时候你就先把牛吹出去都行"（[00:28:32]）。
- 他举马斯克为 fake it till make it 的极致（[00:29:32]）。
- 谷雨认为一些高中毕业甚至不读本科就直接工作的人是合理的，前提是在教育资源丰富的地方，所以不会成为大众现象（[00:29:32]–[00:30:36]）。
- 谷雨说 2025 年到 2026-11 的一年多里，创业从非主流变成了随大流，原因是钱多（[00:30:36]）。他说 NeoCognition 种子轮 4,000 万美元在硅谷已算很大，常见的种子轮是 500 万到 1,000 万美元；他 2026-06 才知道，国内可能有一些 NeoLab 在 2026 上半年直接拿到约 20 亿美元估值（转录作"tubillion dollar"，按 two billion 还原，未核实）（[00:31:37]）。谈到回购和对赌条款时，他说创业者的压力不在个人财务，更多是会不会浪费几年时间（[00:32:38]）。

### AI 视频

- 谷雨说截至 2026-11 的几个月里，AI 视频生成已能做两个小时左右、前后一致的电影；他在 B 站看了一部用 AI 让林正英"回归"的两个多小时僵尸片，七八个角色的脸、情节和衣着从头到尾一致，他是当电影沉浸着看的（[00:32:38]–[00:33:38]）。
- B 站会声明 AI 创作，观众知道是 AI 做的，弹幕都在讨论剧情；随后有人说大家最终在意的是 deliverable 长什么样，而不在意它怎么产生（说话人不确定，较可能是 Koji，谷雨表示同意）（[00:33:38]）。

### Personal agent

- 谷雨承认 coding 和 Computer Use 变强对 personal agent 有帮助，但认为它在 2026 年起来主要靠两个产品设计：一是一个 persistent 的单一会话，像微信里一个人一个窗口，ChatGPT、Claude 那种按 session 管理的方式不适合做助手；二是拟人化，例如卡通形象（[00:35:41]–[00:36:42]）。
- 他认为 proactiveness 不是新技术，OpenClaw（疑似，转录作 open cloud）和 ChatGPT、Claude 的定时任务都能做到（[00:37:43]）。
- 谷雨自己同时用两个 personal agent，主要让它们看邮件、挑重点、按优先级推送；国内的外卖、订酒店、订机票服务用不了（[00:37:43]）。他认为同时用两个只是尝鲜，真形成依赖后一个就够（[00:37:43]–[00:38:44]）。

## 分歧

### 嘉宾与主持之间

- 发布节奏：谷雨认为团队太本分，公司层面"先把牛吹出去都行"（[00:28:32]）。随后有人补充不能 bluff、说了之后要能 deliver，但先说出来能成为第一个 momentum 的创造者（[00:29:32]）；这句较可能是 Koji 说的，归属不确定。双方都承认节奏要把握，分歧在愿意先承诺多少。
- 读 PhD 的理由：Koji 追问"想读"背后要不要分析为什么想，谷雨认为只要真的想就够了，想做就去做本身就是一种理性（[00:22:24]–[00:23:26]）。
- NeoLab 做 RSI 的门槛：Koji 提出 NeoLab 仍要融到更多钱才有卡和数据（[00:03:05]），谷雨同意，并说他看好的两家都拿了很多钱（[00:04:05]）。这里两人没有分歧，但它限定了谷雨"NeoLab 有灵活性"那条判断的适用范围。

### 嘉宾的利益相关

- NeoCognition 做 continual learning（[00:00:00]）。谷雨的几条核心判断都指向自己的方向：continual learning 是区分前沿模型的维度（[00:11:14]），记忆笔记式持续学习的上限被低估（[00:16:18]），2026 年到 2027 年下半年之前的关键词是 continual learning（[00:39:45]）。
- Apprentice Bench 是 NeoCognition 自己的 benchmark，数据未公开（[00:12:15]），分数和设计都无法外部复核；他说它"告诉大家未来应该追求的方向"（[00:09:14]），这既是研究主张，也是公司的叙事。
- 谷雨把自己的公司归为 NeoLab（[00:00:00]），"RSI 是 NeoLab 的机会"这一判断同样有利于他所在的赛道。

### 与 Anthropic blog 的对照

- 谁从 AI 写 infra 中受益：Anthropic 描述的复利加速发生在头部实验室自己的流程里，它判断最可能的前景是 AI 实验室效率持续复利增长（[blog页](../blogs/20260918-anthropic-when-ai-builds-itself.md) §4¶8），并报告截至 2026-05 合入代码 80% 以上由 Claude 编写（[blog页](../blogs/20260918-anthropic-when-ai-builds-itself.md) §2¶4）；它没有讨论新进入者是否会更快。谷雨接受 AI 会接管研发执行这个前提，推论出头部公司积累的 infra 和 recipe 会成为负担，从零开始的 NeoLab 可能加速更快（[00:02:04]–[00:03:05]）。两者不冲突，区别在谷雨点出了另一类受益者；他的依据是一则转述的案例，Anthropic 的依据是外部无法复核的内部数据。
- 瓶颈在哪：Anthropic 认为局部加速后，人工审查和定方向会成为整体速度的上限（[blog页](../blogs/20260918-anthropic-when-ai-builds-itself.md) §4¶8），见 [AI 研发中的人类瓶颈](../concepts/human-bottleneck-in-ai-rd.md)；两人谈 NeoLab 做 RSI 的门槛时只提到钱、卡和数据（[00:03:05]），没有谈人类环节。
- 能否自我评判：谷雨认为 informal 方法在数学上的成功说明模型不靠形式化系统提供信号也能走得很远（[00:13:16]–[00:14:16]）。Anthropic 认为 Claude 在选择目标的判断上仍有很大差距（[blog页](../blogs/20260918-anthropic-when-ai-builds-itself.md) §2¶2）。两者说的不是同一种判断：数学题有明确的对错，选研究目标没有。

## 可验证的预测

| 预测 | 到期 | 状态 | 锚点 |
|---|---|---|---|
| 2027 年会出现一个来自 RSI 创业公司的最强模型，至少是前沿级别的模型 | 2027-12 | 待验证 | （[00:39:45]） |
| 从 2026 年到 2027 年下半年之前，模型发展的关键词是 continual learning | 2027-06 | 待验证 | （[00:39:45]） |

到期时间的取法：原文是"明年"，节目发布于 2026-11-08，第一条取 2027 年底；第二条原文是"起码到明年下半年之前"，取 2027-06。第二条是方向判断，本库按 2027-06 前头部实验室是否把 continual learning 作为主要发布方向来回看。谷雨在说第一条前声明它不是"一定会发生"（[00:39:45]）；第二条他用"我觉得这可能是……一个关键词吧"表述，也是倾向性判断（[00:39:45]）。

下面几条没有时间或无法量化，不进上表：

- Apprentice Bench 很快会发新版本，最强模型在新版本上的分数会比第一版的约 80 分低很多（[00:11:14]）。
- 十年后大学教授的社会地位可能不如夜店男模（[00:21:23]）。谷雨说他是认真的，但这条没有可操作的判定标准。
- 对 personal agent 形成依赖后，一个就够用（[00:37:43]–[00:38:44]）。
- "明年公司被高价收购"是谷雨的玩笑，不算预测（[00:38:44]）。
