---
title: 自动化 AI 研究
type: concept
summary: 把 AI 研发的执行、设计和选题逐级交给 AI，直到 AI 能端到端研发自己的后继者
topics: [rsi]
aliases: [automated AI R&D, AI R&D automation, automated researcher, closing the loop, AI 自动化 AI 研发]
added: 2026-11-27
status: established
relations:
  - { topic: rsi, rel: part-of }
---

## 定义

来源：[Anthropic / When AI builds itself](../blogs/20260918-anthropic-when-ai-builds-itself.md)

让 AI 系统承担 AI 研发本身的工作，包括写代码、跑实验、提出假设和选择研究问题；推到极点，AI 能自主设计并开发自己的后继者，也就是递归自我改进（§0¶2）。它要回答的问题是：研发的哪些环节已经能交给 AI，离闭环还差哪一环（§2¶2）。Anthropic 的时间线把这一阶段称为"Closing the loop"（§0¶18），设想 agent 能自己构建和训练模型（§0¶19）。

## 演化

## 设计空间

来源：[Anthropic / When AI builds itself](../blogs/20260918-anthropic-when-ai-builds-itself.md)

下表按委托给 AI 的层级排列。前三行借用 Anthropic 描述员工成长的任务阶梯（§2¶3）；最后两行是本库为待录入素材预留的位置。

| 层级 | 人给什么 | AI 做什么 | 现状 |
|---|---|---|---|
| 执行指定任务 | 明确的任务，如"导出按钮坏了，修好它"（§2¶3） | 按要求实现 | Anthropic 认为在执行目标明确的实验上 Claude 已追平或超过熟练的人（§2¶2）；训练代码提速任务上约 52 倍（§2¶12） |
| 自己设计做法 | 只给目标，如"查清网络为何在高负载下变慢"（§2¶3） | 设计并实施方法 | Anthropic 认为工程上人只需给目标，不再需要给方法（§2¶2）；最开放任务成功率 76%（§2¶9） |
| 决定做什么 | 不给具体问题，如"下季度团队该做什么"（§2¶3） | 选择值得做的问题 | Anthropic 认为这一层差距仍大（§2¶2）；研究下一步判断胜过人类选择的比例 64%（§2¶15） |
| 实验室内的自动化研究员 | 研究问题和评分规则（§2¶13） | 提出假设、做实验、与并行 agent 共享发现并迭代 | weak-to-strong 监督问题上恢复 97% 的差距，结果没有干净地迁移到生产规模模型（§2¶13） |
| 端到端论文 agent（待录入） | 研究方向 | 从想法、实验到写出论文 | The AI Scientist 一类，待录入 |
| 自我修改的 agent（待录入） | 评测 benchmark | 改写自己的代码或 harness，用 benchmark 验证改动 | Darwin Gödel Machine 一类，待录入 |

## 共识与分歧

来源：[Anthropic / When AI builds itself](../blogs/20260918-anthropic-when-ai-builds-itself.md)

- Anthropic 认为执行层已大体可以交给 Claude，差距集中在选择目标的判断（§2¶2），见 [AI 研发中的人类瓶颈](human-bottleneck-in-ai-rd.md)。
- 反方认为仍在人手里的选题判断才最重要（§4¶1）；Anthropic 认为 AI 进展大多是增量工作，这类工作正是 Claude 擅长的，所以推动前沿的工作大多可以自动化（§4¶2）。
- 本库判断：Anthropic 的自动化研究员做的是问题和评分规则都由人给定的任务（§2¶13），能自动打分的问题最适合自动化；没有可靠评测器的研究问题能否同样交给 AI，原文没有给证据。
- 谁从中受益：Anthropic 认为最可能的前景是 AI 实验室效率持续复利增长（§4¶8），它描述的加速发生在头部实验室自己的流程里（§2¶4）。NeoCognition 联创谷雨认为，AI 写训练 infra 和 recipe 的能力超过人之后，头部模型公司积累的 infra 和 recipe 反而会成为负担，从零开始的 NeoLab 能让 AI 随时重搜、随时丢弃，可能加速更快（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:02:04]–[00:03:05]）；他同时承认 NeoLab 要做 full stack 训练仍需要大量的钱（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:03:05]）。谷雨的证据是一则转述的国内模型厂案例（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:03:05]），Anthropic 的证据是外部无法复核的内部数据，两者都不足以判断哪一方更快。

## 开放问题

- 在没有自动评分器的开放研究问题上，自动化研究员能否成立？
- 小规模问题上的结果怎样迁移到生产规模模型（§2¶13）？
- 委托到"决定做什么"这一层之后，人保留哪些控制点才算足够？
- 先发者积累的训练 infra 和流程，在 AI 接管研发执行之后是资产还是负担（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:02:04]）？
