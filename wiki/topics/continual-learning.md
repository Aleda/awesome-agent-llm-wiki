---
title: Continual Learning
type: topic
summary: agent 在部署后从经验中持续变好，同时不丢掉已有能力
aliases: [持续学习, lifelong learning]
added: 2026-11-26
order: 4
---

## 这个方向在解决什么

模型训练完成后能力基本固定，agent 在部署中却不断遇到新任务、新工具和新反馈。continual learning 问的是：这些经验能否让 agent 在之后的任务上持续变好，同时不破坏已有能力。经典难点是灾难性遗忘：直接在新数据上更新权重，旧任务的表现常常下降。对 agent 还有一个前置问题：经验该沉淀在哪里，可以是模型权重、提示词和上下文、外部记忆，也可以是可复用的技能代码。

## 概念地图

### 经验存在哪里

- 参数式：在线微调、用强化学习更新权重。
- 非参数式：把经验写进提示词、文字笔记或技能库，权重不变。
  - [记忆笔记](../concepts/memory-notes.md)：跨任务积累的规则和教训，由模型反复改写，下次任务读回；写笔记的能力本身也可以训练。同一任务多次尝试之间的反思（Reflexion 一类）见下面「从反馈中学」，录入后预计挂为记忆笔记的 `extends`。

### 从反馈中学

- 语言反馈与反思：把失败原因写成文字，供下一次尝试参考（Reflexion 一类）。Generative Agents 也有"反思"，但它概括的是对人和事的推断，不针对任务成败，归在 memory 方向的[记忆流与反思](../concepts/memory-stream-reflection.md)。
- 技能库：把成功的行为保存为可调用的代码，逐步积累（Voyager 一类）。

### 怎么评测

- [连续任务流评测](../concepts/streaming-task-evaluation.md)：任务按顺序连成一条流，后面的任务依赖前面学到的东西，测 agent 边做边学的能力（如 [Apprentice Bench](../glossary.md#apprentice-bench)）。

### 学了不忘

- 灾难性遗忘及其缓解：经验回放、正则化、参数隔离。

### 学习的时机

- 测试时学习：在推理阶段针对当前任务临时更新。

## 关键争论

- 改权重还是改上下文：非参数式方法便宜、可读、可回滚，但受上下文容量限制；参数式方法能把经验内化，但要处理遗忘和训练成本。NeoCognition 联创谷雨认为改写记忆笔记不是可靠的优化算法，但上限主要受模型能力限制，模型变强、并用数据专门训练写笔记的能力后，上限可观（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:16:18]–[00:17:18]、[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:11:14]），见[记忆笔记](../concepts/memory-notes.md#共识与分歧)。
- 只改提示词的方法收益能保留多久：换任务分布、换底座模型版本之后，积累的反思和技能还有多少用。谷雨说 NeoCognition 早期把做对的轨迹封装成 reusable skill 的 pipeline，在 Claude Opus 5.5 上已不再需要（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:06:08]）。
- 长程应该怎么测：单个要做半天的难题，还是一串前后依赖、要边做边学的任务。谷雨认为前者难找也难扩展，真正的长程是员工从菜鸟变成老员工的过程（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:08:13]–[00:09:14]），见[连续任务流评测](../concepts/streaming-task-evaluation.md)。
- 与 memory、RSI 的边界：一个 agent 持续积累经验并改进自己，什么时候算记忆，什么时候算学习，什么时候算自我改进。

## 最近进展
