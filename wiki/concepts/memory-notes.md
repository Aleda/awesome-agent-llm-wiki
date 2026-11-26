---
title: 记忆笔记
type: concept
summary: 模型把跨任务学到的规则和教训写成笔记并反复改写，让后续任务做得更好
topics: [continual-learning, memory]
aliases: [memory notes, 经验笔记, notes-based continual learning, 记忆笔记式持续学习]
added: 2026-11-27
status: emerging
relations:
  - { topic: continual-learning, rel: part-of }
  - { topic: memory, rel: part-of }
---

## 定义

来源：[十字路口 / 对话谷雨](../podcasts/20261108-crossing-gu-yu.md)

模型把跨任务学到的经验和做法，即规则、教训和处理某类事的流程，写成自然语言笔记，并在之后的任务中不断改写，读回使用，目的是让后续任务做得更好；权重不变，经验存在笔记里。它存的是程序性经验，存事实的记忆另归一类。它要解决的问题是：部署后的 agent 怎样在不重新训练的情况下，从之前的任务中持续变好。谷雨用的说法是"通过 rewrite memory notes 的方式做 continual learning"（[00:16:18]）。

边界和计划录入素材的预期关系（素材录入时再按全文确认）：

- 存事实、存观察的记忆不属于这一页。A-MEM 的互链笔记和记忆演化、Mem0 的 ADD/UPDATE/DELETE 操作，归 [Memory](../topics/memory.md) 方向的结构化记忆；它们解决的是记住并取回信息。
- MemGPT 的自编辑记忆是模型改写自己记忆的一种机制，可以用来实现记忆笔记，但它本身不限定存什么，预计挂为 `applies` 或只在设计空间对照。
- Reflexion 把失败原因写成文字反思，供同一任务的下一次尝试参考，是在同一任务的多次尝试之间学习；预计挂为 `extends`；它在同一任务的多次尝试之间学习，这里的笔记跨任务留存。
- [模型自管理上下文](model-managed-context.md)里 CLM 的 notes 角色记的是当前任务的进度，任务结束就不再需要，与这里跨任务留存的笔记不同。

## 演化

## 设计空间

下表按经验存放的位置比较几条路线。改权重和技能库两行取自 [Continual Learning](../topics/continual-learning.md) 主题页的分类，对应素材待录入。

| 路线 | 经验存在哪里 | 优点 | 代价与疑点 |
|---|---|---|---|
| 记忆笔记 | 自然语言笔记，反复改写 | 不训练、可读、可回滚 | 谷雨认为不是可靠的优化算法，笔记质量受模型能力限制（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:16:18]–[00:17:18]） |
| 技能库 | 可调用的代码或封装好的 skill | 成功行为可以直接复用 | NeoCognition 早期把做对的轨迹封装成 reusable skill，谷雨说 Opus 5.5 已能自己完成这套流程（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:06:08]） |
| 改权重 | 模型参数 | 经验内化，不占上下文 | 训练成本和灾难性遗忘 |
| 训练模型写笔记 | 笔记仍在外部，但写笔记的能力进权重 | 两者结合 | 谷雨说 OpenAI 和 Anthropic 各有 recipe，但还不成熟（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:11:14]） |

## 共识与分歧

来源：[十字路口 / 对话谷雨](../podcasts/20261108-crossing-gu-yu.md)

- 谷雨 2026 上半年公开认为这种方式不靠谱，理由是改写笔记不是一个 reliable 的 optimization algorithm（[00:16:18]）。
- 他在 2026-11 修正为：仍不可靠，但上限被低估了；之前的主要问题是笔记质量被模型自身能力卡住，模型变强后上限可能相当可观（[00:16:18]–[00:17:18]）。
- 谷雨认为提升 continual learning 最重要的数据是让模型更好地写 memory notes 的数据，Claude Code、Codex 这类 long session 可能天然带有这种数据（[00:11:14]）；他说截至 2026-11 只有 Anthropic 和 OpenAI 做得好（[00:17:18]）。
- 截至 2026-11，本库只有这一个来源，且来源方的公司做 continual learning；"只有两家做得好"是谷雨的观察，依据包括他公司未公开的 benchmark（[00:12:15]），外部无法复核。

## 开放问题

- 笔记改写既然不是可靠的优化算法，怎样防止错误经验被写进笔记后一直留存？
- 笔记的收益是否随底座模型更换而保留？
- 写笔记的能力能否像谷雨设想的那样通过训练数据提高，需要什么样的数据（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:11:14]）？
