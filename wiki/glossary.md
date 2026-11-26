---
title: 术语表
type: raw
---

收录产品名、模型名、benchmark 和缩写，每条一两句定义，不建独立概念页。格式：

```
## <术语>

一两句定义。
```

正文中链接术语用 `[术语](../glossary.md#<slug>)`，`slug` 为术语转小写后，连续的非 `[a-z0-9]` 字符合并为一个 `-` 并去掉首尾 `-`。

## AA-LCR

Artificial Analysis Long Context Reasoning，Artificial Analysis 发布的长上下文推理 benchmark：100 道人工编写的题目，每题要跨一组平均约 100K token 的真实文档综合证据、多步推理作答。

## Aider

开源的命令行 AI 编程助手，能在现有代码库里按要求实现功能、修 bug 和重构。The AI Scientist 用它改代码跑实验，DGM 在 Polyglot 上拿它作人工设计 agent 的对照。

## ALFWorld

Shridhar 等 2020 年发布的文本游戏环境，与具身 benchmark ALFRED 对齐：agent 用文本动作在模拟的家庭环境里移动和操作物品，完成 6 类高层目标（如在台灯下查看纸张）。ReAct 论文在其中 134 个未见过的游戏上评测成功率。

## AlpacaEval

用 GPT-4 等强模型当评判者、比较指令跟随模型回答胜率的自动评测；AlpacaEval 2.0 报告对 GPT-4 Turbo 的胜率，测试集有 805 条指令。

## Amdahl's law

Amdahl 定律：系统中只有一部分被加速时，整体加速受未被加速部分所占的比例限制。Anthropic 2026-09 的 blog 用它说明 AI 研发局部加速后瓶颈会转移到人工审查等环节。

## Apprentice Bench

NeoCognition 的 continual learning benchmark（截至 2026-11 未公开）：据其联创谷雨介绍，100 道建筑行业会计报账题，每道涉及公司特有的规则和流程，要按顺序连着做，后面的题依赖前面学到的知识。

## AppWorld

Trivedi 等 2024 年发布的 agent benchmark：在模拟的邮件、文件系统等日常应用和 API 环境里，让 agent 写代码调用 API 完成任务，分 test-normal 和 test-challenge 两档难度。指标为 TGC（Task Goal Completion，单个任务完成率）和 SGC（Scenario Goal Completion，同一场景下全部任务都完成的比例），有公开排行榜。

## AutoGPT

2023 年流行的开源 agent 工具：把高层目标分解成多个子目标，再用 ReAct 式循环逐个执行。Voyager 论文把它改写成 Minecraft 里的基线。

## BBH

BIG-Bench Hard，从 BIG-Bench 中挑出的 23 个较难子任务、约 6,500 道题，常用于评测思维链提示下的语言和符号推理。

## BrowseComp-Plus

在 OpenAI 的 BrowseComp 基础上构建的深度研究类 benchmark，为问题配了一个固定的文档语料库，agent 只在这个语料库里检索。语料固定后结果可以复现，也能把检索器的效果和 agent 的推理能力分开评估。

## Claude Code

Anthropic 的编程 agent，2025-02 以 research preview 形式发布，能在终端里读写代码、运行命令。

## Claude Mythos Preview

Anthropic 以预览形式提供的模型，2026 年发布。Anthropic 2026-09 的 blog 中训练代码提速、研究下一步判断和员工问卷等内部指标都用到它。

## Claude Opus 5.5

Anthropic Claude Opus 系列的一个版本，2026-11 前已发布。十字路口 2026-11-08 一期播客里，嘉宾谷雨用它举例说明 Computer Use 的操作层面已基本解决。

## CommonsenseQA

基于 ConceptNet 构造的五选一常识问答数据集，共 12,247 题，训练集 9,741 题、dev 集 1,221 题，test 集不公开；常缩写为 CQA。

## ContextBench

CLM 论文（arXiv 2609.37725）提出的上下文管理诊断 benchmark，含 Needle Retention、Sudoku Sketchpad、KV Store、Log Triage 四个合成任务。任务不需要额外推理或知识，输入总量最高到上下文上限的 24 倍，只测 agent 怎样管理上下文。

## CORE-Bench

评测 agent 计算复现能力的 benchmark（Computational Reproducibility Agent Benchmark）：给定已发表论文附带的代码和数据，agent 要配好环境、跑通代码，并回答关于运行结果的问题。

## CoT

chain-of-thought prompting，Wei 等 2022 年提出的提示方法：让模型在给出答案前先写出中间推理步骤。CoT-SC 是它的 self-consistency 变体，采样多条推理链后取多数答案。

## DGX Spark

NVIDIA 的桌面级 AI 计算机，128GB 统一内存。You don't need long context 论文（arXiv 2611.05306）用它测本地部署时生成延迟和显存随上下文长度的变化。

## DialSim

基于《老友记》《生活大爆炸》《办公室》剧本构建的长期多方对话问答数据集，覆盖 1,300 个会话；A-MEM 论文用它作 LoCoMo 之外的第二个评测集。

## DPO

Direct Preference Optimization，直接用偏好对训练语言模型的方法，不单独训练奖励模型、也不跑强化学习。

## Dynamic Cheatsheet

Suzgun 等 2025 年提出的测试时学习方法：推理中维护一份外部 cheatsheet，积累可复用的策略和代码片段，每一步由 LLM 重写整份 cheatsheet（累积模式 DC-CU）。ACE 论文以它为主要基线。

## EdgeBench

在真实软件仓库里做长时间优化的 benchmark：agent 在无网络的容器里改进一个代码库，由评测器按 0–100 打分。CLM 论文从中选了 10 个任务，称为 EdgeBench-10，每次运行 12 小时。

## estimated optimized retail cost

You don't need long context 论文（arXiv 2611.05306）定义的成本估算：以闭源模型的标价为完整窗口下的价格，按实测吞吐比把价格线性降到 16K 窗口时的约 20%，再按新输入、缓存输入和输出 token 分别计价。它假设服务方按窗口大小部署和定价，不是现行实际价格。

## FEVER

Thorne 等 2018 年发布的事实核验 benchmark：每条陈述按 Wikipedia 中能否找到依据，标为 SUPPORTS、REFUTES 或 NOT ENOUGH INFO。

## FiNER

Loukas 等 2022 年发布的金融命名实体识别 benchmark：给 XBRL 财务文档里的 token 标注 139 种细粒度实体类型之一。ACE 论文用它和数值推理任务 Formula 测金融领域的上下文适应。

## FRAMES

Google 发布的多跳问答 benchmark，824 道题，每题要综合 2 到 15 篇 Wikipedia 文章作答。You don't need long context 论文把它改成 agent 在固定 Wikipedia 语料里逐步检索的形式。

## GEPA

Genetic-Pareto，Agrawal 等 2025 年提出的提示词优化方法：收集执行轨迹，用自然语言反思诊断错误、提出新的完整提示词，再用遗传式 Pareto 搜索保留表现好的候选。ACE 论文的离线基线之一。

## GPT-J

Wang 和 Komatsuzaki 2021 年发布的开源自回归语言模型，Toolformer 论文记为 6.7B 参数，并以它为底座模型。

## GRPO

Group Relative Policy Optimization，DeepSeekMath（2024）提出的强化学习算法。对同一个提示采样一组回答，用组内奖励的相对高低估计优势，因此不需要单独训练价值模型（critic）。

## GSM8K

OpenAI 2021 年发布的小学数学应用题数据集，约 8.5K 道题，答案为一个数字，常用 Exact Match 评分，也常用于评测思维链提示。

## Heilbronn triangle problem

Heilbronn 三角形问题：在单位区域内放置 n 个点，使任意三点构成的三角形中面积最小的那个尽可能大。AlphaEvolve 和 OpenEvolve 把它用作数学优化测试题。

## HotpotQA

Yang 等 2018 年发布的多跳问答 benchmark，回答每个问题要综合两段或更多 Wikipedia 段落。ReAct 论文只给模型问题、不给支撑段落，指标为 exact match（EM）。

## HumanEval

OpenAI 2021 年发布的代码生成 benchmark：164 道 Python 函数题，按函数签名和文档字符串写出函数体，用隐藏单元测试判定，常用指标是 pass@1。

## HumanEvalFix

OctoPack 工作发布的短代码修复 benchmark：要求模型修复带 bug 的函数，用单元测试判定，测试集 164 题，覆盖 Python、JavaScript、Java、Go、C++、Rust。

## InterCode

Yang 等 2023 年发布的交互式编程框架，把编程任务表述为 agent 在 Docker 容器里执行命令、读取执行反馈的循环；其中 InterCode-Bash 环境即 SWE-agent 论文的 Shell-only 基线。

## LAMA

Petroni 等 2019 年发布的事实知识探测 benchmark：把事实写成缺一个词的陈述句让模型补全。Toolformer 论文用其中的 SQuAD、Google-RE、T-REx 子集。

## LeetcodeHardGym

Reflexion 论文发布的代码生成环境：40 道 LeetCode 困难题，均在 2022-10-08 之后发布，覆盖 19 种编程语言。

## Llama 2

Meta 2023 年发布的开放权重大语言模型系列，有 7B、13B、70B 等规模，另有对话微调版 Llama 2-Chat。

## LLM-as-a-Judge

用一个 LLM 按提示给的标准评价回答或产出的做法，可以打分，也可以在两个回答间判胜负。

## LoCoMo

评测长期对话记忆的数据集（Maharana 等，2024），两人跨多次会话聊日常，每段对话配一组问答，按单跳、多跳、时间、开放域、对抗分类；也写作 LOCOMO。A-MEM 论文说对话平均约 9K token，Mem0 论文说约 26000 token。

## LOONG

多文档长上下文问答 benchmark，1,600 道题，一道题通常依赖多份完整的财报、法律案例或论文，中英文都有，证据有意分散在多份文档里。

## MBPP

Mostly Basic Python Problems，Google 2021 年发布的入门级 Python 编程 benchmark，按自然语言描述写函数，用单元测试判定。

## METR time horizon

METR 提出的能力度量：在一组任务上，模型能以 50% 可靠度完成的任务，对应熟练的人需要多长时间。Anthropic 2026-09 的 blog 引述这一时长约每四个月翻一番。

## Mind2Web

OSU NLP 组 2023 年发布的 web agent benchmark，任务取自真实网站，要求 agent 按自然语言指令完成网页操作。Online-Mind2Web 是它在真实在线网站上评测的变体。

## MineDojo

NVIDIA 等 2022 年发布的开源 Minecraft AI 框架，含模拟环境和从 YouTube、Wiki、Reddit 收集的知识库。Voyager 的实验环境建在它之上。

## Mineflayer

控制 Minecraft 机器人的开源 JavaScript 库，提供移动、挖掘、合成等高层 API。Voyager 让 GPT-4 写调用它的代码来行动。

## mini-swe-agent

SWE-agent 团队发布的极简软件工程 agent harness：每轮只发一个 Bash 命令，动作和结果逐条追加进对话。You don't need long context 论文以它为基础 harness，并推广出面向非编程任务的 mini-agent。

## MT-Bench

多轮对话评测集，覆盖数学、代码、推理、角色扮演、写作等类别，由 GPT-4 按 10 分制给回答打分。

## Multi-Session Chat

Xu 等 2021 年发布的多会话对话数据集（MSC），由众包标注者扮演固定人设、跨五次会话聊天；MemGPT 论文在它之上加了第六次会话的问答来测记忆。

## NaturalQuestions-Open

Natural Questions 的开放域版本：问题来自真实的 Google 搜索查询，答案由人工从 Wikipedia 标注，评测时模型只拿到问题本身或检索到的段落。

## NeoLab

业内对新一批 AI 研究型创业公司的称呼，介于头部前沿实验室和应用型创业公司之间，通常由研究者创办、以研究方向立身。

## NIAH

Needle in a Haystack，在长篇无关文本的指定深度插入一句目标事实，再提问这条事实，用来测模型在长输入中的检索能力。

## OpenEvolve

社区开发的开源框架，仿照 DeepMind 的 AlphaEvolve 实现，并非 DeepMind 官方发布。LLM 反复提出程序改动，评测函数给每个候选程序打分，按进化算法保留得分更高的版本并在其上继续变异。

## perplexity

困惑度，语言模型对一段文本的预测难度，等于平均负对数似然的指数；某个 token 的困惑度越低，说明模型越能根据前文猜到它。LLMLingua 用小模型的困惑度判断哪些 token 可以删掉。

## Polyglot

Aider 团队维护的编程 benchmark，题目涵盖 C++、Go、Java、JavaScript、Python、Rust 等多种语言，多数题要在单个文件里从零实现解法；排行榜报告 pass@2。

## prefix-reuse FLOPs

CLM 论文定义的推理成本指标：按带前缀缓存的推理服务计算整条轨迹的理论 FLOPs，包括解码、预填，以及上下文中段被编辑后从第一个不匹配位置起的重预填。

## Project Glasswing

Anthropic 的网络安全项目，用 Claude Mythos Preview 在重要软件系统中查找漏洞。

## Qwen

阿里巴巴通义团队发布的开源大模型系列。CLM 论文用到的 Qwen3.6-27B 是混合架构，64 层中 48 层为线性注意力；另一个是 Qwen3.5-9B。

## RULER

NVIDIA 发布的合成长上下文测试集，13 个任务，包括多种 needle 检索变体、变量追踪、高频词提取和多跳问答，用来测模型的有效上下文长度。

## Selective-Context

Li 2023 年提出的提示词压缩方法：用小语言模型计算每个词、短语或句子的自信息，删掉信息量低的部分。LLMLingua 的直接前作和主要基线。

## SGLang

开源的 LLM 推理服务框架。它的 RadixAttention 用基数树管理 KV cache，让共享前缀的请求复用已算好的缓存。

## Smallville

Generative Agents 论文自建的像素风沙盒小镇，有咖啡馆、酒吧、学校、住宅等场所，住着 25 个 agent。

## Software World

CLM 论文自建的多仓库优化任务：六个 agent 各负责一个仓库（requests、urllib3 和四个下游包），并行工作 24 小时以上提升性能，在 agent 看不到的下游包基准上按几何平均加速比打分。

## SWE-bench

Princeton 团队 2023 年发布的软件工程 benchmark，任务取自真实 GitHub 仓库的 issue：模型要生成代码补丁，用当初修复该 issue 的 PR 中的测试判定是否解决。SWE-bench Verified 是 OpenAI 于 2024 年发布的 500 题子集，题目经过人工核验。

## SWE-bench Lite

SWE-bench 的 300 题标准子集，只收自包含的功能性 bug 修复。SWE-agent 论文在它上面做消融和分析。

## SWE-bench Verified

OpenAI 经人工筛选的 SWE-bench 子集，共 500 题，保留确认可解的任务。

## TALM

Tool Augmented Language Models，Parisi 等 2022 年的工作，用自监督目标迭代地教模型调用计算器和搜索引擎，只在针对下游任务微调的设置下验证。Toolformer 论文称它是最接近的前作。

## TBLite

OpenThoughts-TBLite，由 OpenThoughts-Agent 团队发布的终端 agent benchmark，定位是便于快速迭代的高信号任务集。CLM 论文按 TerminalBench 2.1 的方式设置轮数、时限和评分。

## TerminalBench

评测 agent 在终端环境中完成任务的 benchmark，也写作 Terminal-Bench。每个任务在容器里运行，agent 通过命令行操作，由任务附带的测试脚本判定是否完成。

## WebShop

Yao 等 2022 年发布的模拟网购环境，含 118 万件真实商品和 1.2 万条人写的购物指令，agent 通过搜索、点选商品和选项完成购买，按平均得分（满足的属性比例）和成功率评测。

## Zep

为 AI agent 提供记忆管理的平台，把记忆存成图；Mem0 论文把它作为基线之一，并描述它在每个节点存一份摘要、在边上存事实。

## Zettelkasten

卡片盒笔记法：每张卡片只记一个原子化的想法，卡片之间用链接相连，知识网络随新卡片加入而生长。A-MEM 借用了这一组织方式。
