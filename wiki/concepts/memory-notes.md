---
title: 记忆笔记
type: concept
summary: agent 把经验写成自然语言笔记并反复改写，下次任务读回，权重不变地实现持续学习
topics: [continual-learning, memory]
aliases: [memory notes, Memory Notes, 经验笔记, notes-based continual learning, 记忆笔记式持续学习]
added: 2026-11-27
status: emerging
relations:
  - { topic: continual-learning, rel: part-of }
  - { topic: memory, rel: part-of }
---

## 定义

来源：[十字路口 / 对话谷雨](../podcasts/20261108-crossing-gu-yu.md)

agent 在任务中把学到的规则、教训和经验写成自然语言笔记，之后不断改写这些笔记，在后续任务里读回使用；权重不变，经验存在笔记里。它要解决的问题是：部署后的 agent 怎样在不重新训练的情况下，从之前的任务中持续变好。谷雨用的说法是"通过 rewrite memory notes 的方式做 continual learning"（[00:16:18]）。

[Memory](../topics/memory.md) 方向的检索式记忆主要解决记住并取回事实；记忆笔记的目的是让后续任务做得更好。[模型自管理上下文](model-managed-context.md)里 CLM 的 notes 角色记的是当前任务的进度，任务结束就不再需要，与这里跨任务留存的笔记不同。[Continual Learning](../topics/continual-learning.md) 主题页列出的语言反馈与反思（Reflexion 一类）也把经验写成文字，那条路线的素材待录入后，再判断两者是否应合并为一页。

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
