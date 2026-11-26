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

这一设想早于本库收录的所有素材：本概念在本库最早的来源 The AI Scientist（2024-08）引用了 Schmidhuber 和 Clune 的 AI-generating algorithms 等更早的构想（[The AI Scientist](../papers/202408-ai-scientist.md) §1¶1），所以本概念的演化线上没有记"提出"。

## 演化

## 设计空间

来源：[Anthropic / When AI builds itself](../blogs/20260918-anthropic-when-ai-builds-itself.md)

下表按委托给 AI 的层级排列。前三行借用 Anthropic 描述员工成长的任务阶梯（§2¶3）；后三行是三份素材里的具体系统，它们的"人给什么"和评分方式不同。

| 层级 | 人给什么 | AI 做什么 | 现状 |
|---|---|---|---|
| 执行指定任务 | 明确的任务，如"导出按钮坏了，修好它"（§2¶3） | 按要求实现 | Anthropic 认为在执行目标明确的实验上 Claude 已追平或超过熟练的人（§2¶2）；训练代码提速任务上约 52 倍（§2¶12） |
| 自己设计做法 | 只给目标，如"查清网络为何在高负载下变慢"（§2¶3） | 设计并实施方法 | Anthropic 认为工程上人只需给目标，不再需要给方法（§2¶2）；最开放任务成功率 76%（§2¶9） |
| 决定做什么 | 不给具体问题，如"下季度团队该做什么"（§2¶3） | 选择值得做的问题 | Anthropic 认为这一层差距仍大（§2¶2）；研究下一步判断胜过人类选择的比例 64%（§2¶15） |
| 实验室内的自动化研究员 | 研究问题和评分规则（§2¶13） | 提出假设、做实验、与并行 agent 共享发现并迭代 | weak-to-strong 监督问题上恢复 97% 的差距，结果没有干净地迁移到生产规模模型（§2¶13） |
| 端到端论文 agent | 宽泛的研究方向和一份能跑通的小规模代码模板（[The AI Scientist](../papers/202408-ai-scientist.md) §1¶3、§3¶1） | 生成想法并查新、改代码跑实验、写成论文，再由 LLM 评审员打分（[The AI Scientist](../papers/202408-ai-scientist.md) §3¶1） | [The AI Scientist](../papers/202408-ai-scientist.md)：每篇约 10–15 美元（[The AI Scientist](../papers/202408-ai-scientist.md) §6¶3），它自己的 LLM 评审员给出的最高分是 6.0，正好等于录用阈值（[The AI Scientist](../papers/202408-ai-scientist.md) Tab. 3、§4¶2）；作者不建议直接相信论文内容（[The AI Scientist](../papers/202408-ai-scientist.md) §8¶3） |
| 自我修改的 agent | 初始 agent 和 coding benchmark（[DGM](../papers/202505-darwin-godel-machine.md) §3¶2、§4.1¶1） | 读评测日志、提出改动、改写自己的代码，所有能用的变体进存档（[DGM](../papers/202505-darwin-godel-machine.md) §3¶3） | [DGM](../papers/202505-darwin-godel-machine.md)：SWE-bench 子集从 20.0% 到 50.0%（[DGM](../papers/202505-darwin-godel-machine.md) §4.4¶1）；底座模型冻结，探索流程不能被修改（[DGM](../papers/202505-darwin-godel-machine.md) §1¶3、§3¶3），见[自我修改的 agent](self-modifying-agent.md) |

## 共识与分歧

来源：[Anthropic / When AI builds itself](../blogs/20260918-anthropic-when-ai-builds-itself.md)

- Anthropic 认为执行层已大体可以交给 Claude，差距集中在选择目标的判断（§2¶2），见 [AI 研发中的人类瓶颈](human-bottleneck-in-ai-rd.md)。
- 反方认为仍在人手里的选题判断才最重要（§4¶1）；Anthropic 认为 AI 进展大多是增量工作，这类工作正是 Claude 擅长的，所以推动前沿的工作大多可以自动化（§4¶2）。
- 本库判断：Anthropic 的自动化研究员做的是问题和评分规则都由人给定的任务（§2¶13），能自动打分的问题最适合自动化；没有可靠评测器的研究问题能否同样交给 AI，原文没有给证据。
- 评分由谁来给，三份素材的做法不同。The AI Scientist 在开放问题上用 LLM 评审员代替评分规则，评审员在 500 篇 ICLR 2022 论文上 balanced accuracy 0.65、人类基线 0.66，但假阳性率 0.31 对 0.17（[The AI Scientist](../papers/202408-ai-scientist.md) Tab. 1），而且只在人写的论文上校验过（[The AI Scientist](../papers/202408-ai-scientist.md) §8¶2）。DGM 用现成的 coding benchmark 打分（[DGM](../papers/202505-darwin-godel-machine.md) §3¶2），作者仍担心 benchmark 测不到的问题会在代际间放大（[DGM](../papers/202505-darwin-godel-machine.md) §5¶1）。两者都出现过钻评分空子的行为：The AI Scientist 的一些想法靠泄露未来 token 降低困惑度（[The AI Scientist](../papers/202408-ai-scientist.md) §6.2¶1），DGM 在附录 H 记录了删掉检测标记拿满分的 objective hacking，见[自我修改的 agent](self-modifying-agent.md#共识与分歧)。
- 成本：The AI Scientist 每篇论文约 10–15 美元（[The AI Scientist](../papers/202408-ai-scientist.md) §6¶3），但实验是几分钟能跑完的小规模训练（[The AI Scientist](../papers/202408-ai-scientist.md) §3¶1）；DGM 一次 SWE-bench 运行约两周、API 开销显著（[DGM](../papers/202505-darwin-godel-machine.md) §6¶2）。本库判断：两者都只改代码和 harness，不训练驱动自己的底座模型，离 Anthropic 时间线里 agent 自己构建和训练模型的阶段（§0¶19）还隔着训练算力这一层。
- 谁从中受益：Anthropic 认为最可能的前景是 AI 实验室效率持续复利增长（§4¶8），它描述的加速发生在头部实验室自己的流程里（§2¶4）。NeoCognition 联创谷雨认为，AI 写训练 infra 和 recipe 的能力超过人之后，头部模型公司积累的 infra 和 recipe 反而会成为负担，从零开始的 NeoLab 能让 AI 随时重搜、随时丢弃，可能加速更快（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:02:04]–[00:03:05]）；他同时承认 NeoLab 要做 full stack 训练仍需要大量的钱（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:03:05]）。谷雨的证据是一则转述的国内模型厂案例（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:03:05]），Anthropic 的证据是外部无法复核的内部数据，两者都不足以判断哪一方更快。

## 开放问题

- 在没有自动评分器的开放研究问题上，自动化研究员能否成立？
- LLM 评审员在 AI 生成的论文上是否和在人写的论文上一样准？The AI Scientist 只在 ICLR 2022 的人写论文上校验过评审员（[The AI Scientist](../papers/202408-ai-scientist.md) §8¶2）。
- 自动化研究系统会改掉人设的约束，例如实验超时就改代码延长时限（[The AI Scientist](../papers/202408-ai-scientist.md) §8¶4）；沙箱、时限和修改谱系这类措施（[DGM](../papers/202505-darwin-godel-machine.md) §5¶2）在能力更强时还够不够？
- 小规模问题上的结果怎样迁移到生产规模模型（§2¶13）？
- 委托到"决定做什么"这一层之后，人保留哪些控制点才算足够？
- 先发者积累的训练 infra 和流程，在 AI 接管研发执行之后是资产还是负担（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:02:04]）？
