---
title: "Toolformer: Language Models Can Teach Themselves to Use Tools"
type: paper
summary: 让模型自己在语料里插入 API 调用，只留能降低后续 token 损失的调用再微调，6.7B 模型零样本学会用五种工具
topics: [agent]
aliases: [Toolformer]
added: 2026-11-27
date: 2023-02-09
url: https://arxiv.org/abs/2302.04761
source_dir: sources/papers/2302.04761
venue: NeurIPS 2023
pages: 17
by:
  - { entity: meta, role: org }
  - { name: Universitat Pompeu Fabra, role: org }
  - { name: Timo Schick, role: author }
  - { name: Jane Dwivedi-Yu, role: author }
  - { name: Roberto Dessì, role: author }
  - { name: Roberta Raileanu, role: author }
  - { name: Maria Lomeli, role: author }
  - { name: Luke Zettlemoyer, role: author }
  - { name: Nicola Cancedda, role: author }
  - { name: Thomas Scialom, role: author }
relations:
  - { concept: self-supervised-tool-learning, rel: proposes, note: 在通用预训练语料上让模型自己标注 API 调用，按后续 token 损失的降低筛选后微调模型本身，不绑定具体任务；TALM 已在下游任务微调中用类似的自监督目标 }
  - { source: papers/202210-react, rel: responds }
---

## 新认知

- **Toolformer 让模型自己生成学用工具的训练数据：用少量示例提示模型在普通文本里插入候选 API 调用，执行后只保留能让后续 token 更好预测的调用，再在这份数据上微调模型本身（§1¶3）**；TALM 用过类似的自监督目标，但只在针对下游任务微调的设置下（§6¶2），本库把不绑定任务的这一版记为[自监督工具使用学习](../concepts/self-supervised-tool-learning.md)的最早来源。
- 筛选的比较对象是"不调用"和"调用但不给结果"两者中损失更低的一个（§2¶7），留下的调用必须靠返回结果本身降低损失，只写出调用意图不算有用，见[自监督工具使用学习](../concepts/self-supervised-tool-learning.md#设计空间)。
- **6.7B 的 GPT-J 学会用工具后，零样本下在有对应工具的任务上超过 175B 的 GPT-3：数学三项 40.4 / 29.4 / 44.0 对 14.0 / 10.0 / 19.8（Tab. 4）；开放域问答上仍然落后，WebQS 26.3 对 29.0（Tab. 5）**，作者归因于搜索引擎太简单，且模型不能改写查询或翻看多条结果（§4.2.3¶2），见[自监督工具使用学习](../concepts/self-supervised-tool-learning.md#共识与分歧)。
- 学工具不必牺牲语言建模：API 调用插回原文，其余文本与原语料完全相同（§2¶8）；关掉 API 后，Toolformer 在 WikiText 和 CCNet 上的困惑度与只在同一语料上微调的 GPT-J + CC 相同，都是 10.3 和 10.5（Tab. 8），见[自监督工具使用学习](../concepts/self-supervised-tool-learning.md)。
- "模型自己决定何时调用"有一部分是解码设置推出来的：普通贪心解码下，T-REx 只有 40.3% 的样本调用 API，WebQS 只有 8.5%；作者让 `<API>` 只要排进前 10 就开始调用，比例升到 98.1% 和 100%，而贪心解码时调用时机原有的一定校准在 k 变大后消失（§5¶1），见[自监督工具使用学习](../concepts/self-supervised-tool-learning.md#开放问题)。
- 每个输入最多调用一次 API（§4.2¶2），各工具的训练调用相互独立地采样，所以模型学不会链式调用，也不能翻看结果或改写查询（§7¶1）；它学到的是单步的"何时调用、调什么"，多步交互是[推理与行动交替](../concepts/interleaved-reasoning-acting.md#设计空间)处理的问题。
- 用工具的能力要到约 775M 参数才出现，更小的模型用不用工具表现差不多（§4.4¶2、Fig. 4），见[自监督工具使用学习](../concepts/self-supervised-tool-learning.md#开放问题)。

## 核心问题

语言模型有几类靠扩大规模也只能部分解决的缺陷：拿不到最新信息、容易编造事实、算不准、不知道当前时间（§1¶1）。给模型接上搜索引擎、计算器这类工具可以补上，但已有做法要么依赖大量人工标注，要么只在特定任务里使用工具（§1¶2）。本质上这是"在哪里、调什么工具、传什么参数"的标注问题：人工标注贵，而且人觉得有用的调用不一定是模型觉得有用的（§1¶2）。Toolformer 把它改写成用模型自己的语言建模损失做监督的自训练问题（§6¶3）。

## 核心洞察

一次工具调用有没有用，可以让模型自己衡量：如果把调用和返回结果放在前面，模型更容易预测后面的原文，这次调用就有用（§2¶7）。这个信号不需要任务标签，任何文本都能用，所以可以直接用模型原本的预训练语料来标注（§1¶4）。

## 核心设计

1. **把 API 调用写成文本**：调用表示为 `<API> 名称(输入) → 结果 </API>`，实际用 "[", "]", "->" 三个已有 token 表示，不改词表（§2¶2）。
2. **采样候选调用**：每个工具写一条带少量示例的提示（Fig. 3）；模型在某个位置生成 `<API>` 的概率超过阈值 τs 才把它当作候选位置，最多取 k 个，每个位置最多采样 m 个调用（§2¶4）。
3. **执行并按损失筛选**：执行全部调用拿到结果；比较"调用并给结果"的加权损失和"不调用或只调用不给结果"中较低的一个，只保留损失至少降低 τf 的调用（§2¶7）。损失权重随距离衰减，让调用落在信息真正有用的位置附近（§4.1¶1）。
4. **插回原文并微调**：把留下的调用插回原文，在这份语料上用标准语言建模目标微调（§2¶8）。语料是 CCNet 的一个子集，部分工具先用启发式规则预筛文本，如计算器只看至少含三个数字的文本（§4.1¶1）。
5. **推理时调用**：解码到 "→" 时暂停，调用对应 API，插入结果和 `</API>` 后继续（§2¶9）。评测时只要 `<API>` 排进前 k=10 就开始调用，每个输入最多调用一次，防止模型反复调用不产出答案（§4.2¶2）。
6. **五种工具**：问答系统 Atlas、计算器、基于 BM25 的 Wikipedia 搜索、600M 参数的 NLLB 翻译模型、返回当天日期的日历（§3¶1、§3¶2、§3¶4、§3¶5、§3¶6）。

## 效果

底座是 [GPT-J](../glossary.md#gpt-j)（6.7B），全部零样本评测（§4.2¶1）。GPT-3 是未经指令微调的 davinci（§4.1¶4）。

| 设置 | 基线 | 结果 | 锚点 |
|---|---|---|---|
| [LAMA](../glossary.md#lama) 的 SQuAD / Google-RE / T-REx 子集 | GPT-J 17.8 / 4.9 / 31.9；GPT-3 26.8 / 7.0 / 39.8 | 33.8 / 11.5 / 53.5 | （Tab. 3） |
| 数学：ASDiv / SVAMP / MAWPS | GPT-J 7.5 / 5.2 / 9.9；关掉 API 的 Toolformer 14.8 / 6.3 / 15.0；GPT-3 14.0 / 10.0 / 19.8 | 40.4 / 29.4 / 44.0 | （Tab. 4） |
| 问答：WebQS / NQ / TriviaQA | GPT-J 18.5 / 12.8 / 43.9；GPT-3 29.0 / 22.6 / 65.9 | 26.3 / 17.7 / 48.8 | （Tab. 5） |
| 多语言问答 MLQA：Es / De / Zh | GPT-J 15.2 / 16.5 / 18.2 | 20.6 / 13.5 / 16.8 | （Tab. 6） |
| 时间：TempLAMA / Dateset | GPT-J 13.7 / 3.9；GPT-3 15.5 / 0.8 | 16.3 / 27.3 | （Tab. 7） |
| 困惑度：WikiText / CCNet | GPT-J 9.9 / 10.6；GPT-J + CC 10.3 / 10.5 | 关掉 API 的 Toolformer 10.3 / 10.5 | （Tab. 8） |
| 解码阈值 k，T-REx / WebQS | k=1：调用比例 40.3% / 8.5%，得分 47.8 / 19.3 | k=10：98.1% / 100%，53.5 / 26.3 | （Tab. 9） |
| 各任务调用最多的工具 | — | LAMA 上 98.1% 调问答系统；数学上 97.9% 调计算器；问答上 99.3% 调搜索 | （§4.2.1¶2、§4.2.2¶2、§4.2.3¶2） |

## 局限与疑点

### 作者承认的

- 不能链式调用工具，因为每个工具的训练调用是独立生成的；也不能交互式使用工具，如翻看搜索结果、改写查询（§7¶1）。
- 是否调用 API 对输入的措辞很敏感（§7¶1）。
- 对部分工具非常低效：处理一百多万篇文档，只得到几千条有用的计算器调用（§7¶1）。
- 决定是否调用时不考虑调用的计算成本（§7¶1）。
- MLQA 上不能稳定超过原始 GPT-J，作者归因于在 CCNet 上继续训练造成的分布偏移（§4.2.4¶2）。
- TempLAMA 上的提升不来自日历工具，日历只在 0.2% 的样本里被调用；最佳做法是先查日期再问问答系统，这被"每个输入最多调用一次"的限制排除了（§4.2.5¶2）。

### 本库判断的

- 评测口径宽松：LAMA 只看前五个词里有没有正确答案（§4.2.1¶1），问答看前 20 个词（§4.2.3¶1），数学只取第一个数字（§4.2.2¶1）。这些数字不能和常规 exact match 的结果直接比较。
- LAMA 上为公平起见禁用了 Wikipedia 搜索（§4.2.1¶1），但问答工具 Atlas 本身是检索增强模型（§3¶2），作者附录说推理时换成了更大的 Atlas-xxl。98.1% 的样本都交给它回答（§4.2.1¶2），所以 Tab. 3 衡量的主要是 GPT-J 把问题转交给一个更强外部系统的能力。
- Dateset 是作者自建的，只有知道当天日期才能回答（§4.2.5¶1），日历工具直接给出答题需要的信息，这一项接近给了答案的上界测试。
- "超过 GPT-3"只在有对应工具的任务上成立，比较对象是零样本、未经指令微调的 davinci（§4.1¶4）。问答上 GPT-3 仍然更强（Tab. 5）；MLQA 上 Toolformer 连原始 GPT-J 都不能稳定超过（Tab. 6）。
- 评测时把 `<API>` 的触发阈值放宽到前 10（§4.2¶2），高调用比例部分来自这个设置（Tab. 9）。这与"模型自己决定何时用工具"的说法有张力。
- venue 记为 NeurIPS 2023：arXiv 上只有 2023-02-09 的 v1，comment 为空，PDF 没有写会议；NeurIPS 2023 论文集收录了本文（Main Conference Track），该版本作者多了 Eric Hambro。本页作者按 arXiv v1 记录。全部作者署 Meta AI Research，Roberto Dessì 同时署 Universitat Pompeu Fabra。

## 与其他工作的关系

- 与 [ReAct](./202210-react.md)：Toolformer 把 ReAct 归入"按特定任务写 few-shot 提示、事先知道要用哪个工具"的一类，与自己的自监督方式对比（§6¶2）。ReAct 用提示让冻结的模型在多步里交替推理和行动（[ReAct](./202210-react.md) §2¶3），Toolformer 把单步调用训练进权重（§2¶8）；ReAct 的搜索可以多次改写查询，正是 Toolformer 自认缺少的交互能力（§7¶1）。见[推理与行动交替](../concepts/interleaved-reasoning-acting.md)。
- 与 [SWE-agent](./202405-swe-agent.md)：两者对"能力放在哪里"的选择相反。Toolformer 改权重、不改工具接口；SWE-agent 固定模型，只改 agent 用的命令和反馈格式（[SWE-agent](./202405-swe-agent.md) §2¶4）。见[面向 agent 的计算机接口](../concepts/agent-computer-interface.md#共识与分歧)。
- 与 [TALM](../glossary.md#talm)：Toolformer 说它是最接近的工作，用类似的自监督目标教模型用计算器和搜索引擎，但只在针对下游任务微调的设置下（§6¶2）。TALM 本库没有收录。
- 与 [STaR](./202203-star.md)：Toolformer 把自己归入自训练和自举一类，在自己的预测上训练，只多了一步基于困惑度的筛选（§6¶3）。STaR 按最终答案对错筛选推理（[STaR](./202203-star.md) §3.1¶1），Toolformer 按后续 token 损失筛选工具调用，见[自举推理](../concepts/bootstrapped-reasoning.md)。
