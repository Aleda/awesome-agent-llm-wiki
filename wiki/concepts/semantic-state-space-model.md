---
title: 语义状态空间模型
type: concept
summary: 后训练模型每轮读写一段自然语言状态并只做一个动作，以此取代累积完整对话历史
topics: [context]
aliases: [Semantic State Space Model, SSSM, SSSMs, semantic state-space model]
added: 2026-11-27
status: emerging
relations:
  - { topic: context, rel: part-of }
  - { concept: frequent-context-compaction, rel: part-of }
---

## 定义

来源：[You don't need long context](../papers/202611-you-dont-need-long-context.md)

一种后训练出来的模型：每轮读入一段用自然语言描述的对话状态，推理下一步、执行一个动作、记录结果，再把结论和结果写回这段状态，交给另一个推理实例继续（§5.1¶2）。它要解决的问题是：现有对话模型按不断增长的完整历史训练，生成代价随上下文深度上升（Fig. 1）；作者设想把单动作压缩变成模型的默认工作方式（§5.1¶1）。

## 演化

## 设计空间

来源：[You don't need long context](../papers/202611-you-dont-need-long-context.md)

| 做法 | 轮次之间传递什么 | 状态能否读懂 | 代表 |
|---|---|---|---|
| 完整历史对话模型 | 全部 token | 能，但随步数增长 | 当前主流做法 |
| State-Space Model | token 之间的神经网络隐状态 | 不能 | Mamba 一类（§5.1¶2） |
| SSSM | 每个动作后重写的一段自然语言状态 | 能 | 本文设想；SAC 是它在现有模型上的 harness 近似（§5.1¶1） |

## 共识与分歧

来源：[You don't need long context](../papers/202611-you-dont-need-long-context.md)

- 目前只有一份素材，且只是设想。作者推测 SSSM 比完整历史模型更省训练数据，并认为没有理由追不平后者（§5.1¶3）；论文没有训练实验。
- 现有模型直接跑 SAC 的结果因模型而异：Opus 4.5 持平或高于完整历史，GPT 5.6 Sol 低 2.0 和 3.3 个点（§5¶2），且低于它的全部四档阈值压缩（Tab. 3、Tab. 5）。

## 开放问题

来源：[You don't need long context](../papers/202611-you-dont-need-long-context.md)

- 后训练数据从哪里来？用现有模型的 SAC 轨迹蒸馏，还是需要专门的 RL 信号？
- 需要逐字回看历史的任务（如第 i 次掷硬币结果，§3.1¶2），语义状态之外还要配什么检索工具？
- 状态完全由模型改写，和 CLM 指出的可编辑上下文注入问题（[CLM](../papers/202609-context-language-models.md) §6¶1）是否同样存在？
