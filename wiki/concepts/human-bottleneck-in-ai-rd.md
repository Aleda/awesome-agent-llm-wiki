---
title: AI 研发中的人类瓶颈
type: concept
summary: 执行环节交给 AI 后，人工审查和定研究方向成为限制整体研发速度的环节
topics: [rsi]
aliases: [research taste, 研究品味, human review bottleneck, 人工审查瓶颈, Amdahl 瓶颈, Amdahl's law in AI R&D]
added: 2026-11-27
status: established
relations:
  - { topic: rsi, rel: part-of }
---

## 定义

来源：[Anthropic / When AI builds itself](../blogs/20260918-anthropic-when-ai-builds-itself.md)

写代码、跑实验这些执行环节交给 AI 之后，留在人手里的审查和定方向成为整体研发速度的上限。Anthropic 用 [Amdahl's law](../glossary.md#amdahl-s-law) 描述这种现象：一部分加速后，整体速度受没加速的部分限制（§4¶8）。它要回答两个问题：局部加速为什么不一定变成整体加速；AI 离自主设计自己的后继者还差哪一环（§2¶2）。

## 演化

## 设计空间

来源：[Anthropic / When AI builds itself](../blogs/20260918-anthropic-when-ai-builds-itself.md)

下表列出 Anthropic 文中提到的人类环节与其他约束，以及各自的缓解办法；最后两行不属于人类环节，列出来是为了对照。

| 环节或约束 | 现状 | 缓解办法 |
|---|---|---|
| 代码审查 | 代码质量持平后人只做审查，审查跟不上生成就成为瓶颈（§3¶1）；Anthropic 已经遇到（§4¶8） | 由 Claude 自动审查，回溯估计能拦下约三分之一事故背后的 bug（§2¶11） |
| 实验执行 | Anthropic 认为执行已几乎不花人的时间（§3¶1）；目标已定的实验优化上 Claude 已超过熟练的人（§2¶12） | 已基本交给 AI |
| 定方向（研究品味） | Anthropic 认为这是人目前的相对优势，包括选什么问题、信什么结果、何时放弃一条路（§3¶2） | 测模型的下一步判断（§2¶15）；weak-to-strong 研究中人只负责定方向（§2¶13） |
| 想法的筛选和跟进 | 新想法、工具和模拟多到跟进不过来（§4¶8） | Anthropic 认为组织发现并修复瓶颈的速度可能成为最重要的能力（§4¶8） |
| 算力和供应链 | 约束可能在芯片制造、电网和互联带宽，智能本身未必是瓶颈（§4¶8） | 原文未讨论 |
| 现实世界 | 药物要几十年才看清效果，选举不能提前（§4¶8） | 原文认为这类瓶颈不随智能加快 |

### 三种前景

来源：[Anthropic / When AI builds itself](../blogs/20260918-anthropic-when-ai-builds-itself.md)

Anthropic 设想了三种前景（§4¶7），区别在于人类环节最后剩下什么。

| 前景 | 人的角色 | Anthropic 的判断 |
|---|---|---|
| 趋势停滞，现有能力扩散 | 不变；瓶颈可能在新架构或算力供应 | 认为不太可能（§4¶8） |
| 实验室效率复利增长 | 人仍定研究方向、评判结果 | 认为最可能（§4¶8） |
| 完全递归自我改进 | 人主要做监督、验证和核实 | 最不确定对齐问题能否解决（§4¶8） |

## 共识与分歧

来源：[Anthropic / When AI builds itself](../blogs/20260918-anthropic-when-ai-builds-itself.md)

- 反方观点：仍在人手里的选题判断才最重要，没有这种判断，Claude 只是能干的助手（§4¶1）。
- Anthropic 的回应分两层。保守解读：即使 Claude 始终没有好的研究品味，人只做个位数比例的定方向工作，每人驾驭的工作量变大，加速仍会复利（§4¶3）。激进解读：研究品味也可能只是又一个先做不好、后来做好的能力（§4¶4）。
- 审查瓶颈在更早的端到端系统上已经出现：The AI Scientist 的作者不建议直接相信生成论文的科学内容，要人工检查实现再信结果（[The AI Scientist](../papers/202408-ai-scientist.md) §8¶3）；案例论文里真正的缺陷要有领域知识才看得出，自动评审员只抓到一部分（[The AI Scientist](../papers/202408-ai-scientist.md) §5¶13）。作者还担心未来模型提出的想法人类难以评估（[The AI Scientist](../papers/202408-ai-scientist.md) §5¶13），本库判断：这和 Anthropic 说的审查跟不上生成就成为瓶颈（§3¶1）是同一个问题。
- Anthropic 认为 AI 进展很少靠"顿悟"，多数是放大规模、修问题、再试，这类工作已经越来越自动化（§4¶2）。本库判断：这一论证依赖"顿悟式进展只占少数"的历史观察，能否外推到品味本身成为瓶颈的阶段，原文没有给证据。

## 开放问题

- 研究品味能否用可复查的方式测量？Anthropic 的下一步判断测试（§2¶15）样本有选择，评判者也是模型。
- 自动审查能拦下约三分之一的事故 bug（§2¶11），剩下的部分是否仍需要人审，审查瓶颈能否完全交给 AI？
- 当定方向也部分交给 AI 时，人保留哪些控制点才算足够？
