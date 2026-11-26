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
  - [记忆笔记](../concepts/memory-notes.md)：跨任务积累的规则和教训，由模型反复改写，下次任务读回；写笔记的能力本身也可以训练。[ACE](../papers/202510-ace.md) 把笔记拆成逐条更新的 playbook，避免整份重写时塌缩。
  - [技能库](../concepts/skill-library.md)：把验证成功的行为存成可执行代码，按描述检索、组合成更复杂的技能。[Voyager](../papers/202305-voyager.md) 在 Minecraft 里提出这一做法，它的技能库交给别的 agent 也能用。
  - 同一任务多次尝试之间的文字反思不跨任务留存，本库按 Reflexion 全文判断为另一个概念，见下面「从反馈中学」。

### 从反馈中学

- [语言反馈强化](../concepts/verbal-reinforcement.md)：任务失败后让 LLM 把成败信号写成文字反思，在同一任务的下一次尝试中读回，权重不变。[Reflexion](../papers/202303-reflexion.md) 是最早来源；它的所有实验都在同一任务内重试，所以本库不把它算作记忆笔记的最早来源。[Voyager](../papers/202305-voyager.md) 的自我验证把评估和写建议合在一个 critic 里，用在同一任务的多轮代码生成之间。
- Generative Agents 也有"反思"，但它概括的是对人和事的推断，不针对任务成败，归在 memory 方向的[记忆流与反思](../concepts/memory-stream-reflection.md)。

### 怎么评测

- [连续任务流评测](../concepts/streaming-task-evaluation.md)：任务按顺序连成一条流，后面的任务依赖前面学到的东西，测 agent 边做边学的能力（如 [Apprentice Bench](../glossary.md#apprentice-bench)）。

### 学了不忘

- 灾难性遗忘及其缓解：经验回放、正则化、参数隔离。
- Voyager 认为把技能存成可组合的程序能缓解其他持续学习方法的灾难性遗忘（[Voyager](../papers/202305-voyager.md) §1¶4），但实验没有测旧技能是否退化，见[技能库](../concepts/skill-library.md#开放问题)。

### 学习的时机

- 测试时学习：在推理阶段针对当前任务临时更新。

## 关键争论

- 改权重还是改上下文：非参数式方法便宜、可读、可回滚，但受上下文容量限制；参数式方法能把经验内化，但要处理遗忘和训练成本。NeoCognition 联创谷雨认为改写记忆笔记不是可靠的优化算法，但上限主要受模型能力限制，模型变强、并用数据专门训练写笔记的能力后，上限可观（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:16:18]–[00:17:18]、[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:11:14]），见[记忆笔记](../concepts/memory-notes.md#共识与分歧)。
- 没有可靠反馈时能不能学：ACE 在 agent 任务上只靠代码执行成败就比基线平均高 14.8 个点（[ACE](../papers/202510-ace.md) §4.3¶2），但在金融任务上，没有标签的在线适应反而低于基础模型（[ACE](../papers/202510-ace.md) Tab. 2），作者认为上下文会被误导信号污染（[ACE](../papers/202510-ace.md) §4.4¶2），见[记忆笔记](../concepts/memory-notes.md#开放问题)。同一任务内的反馈也是这样：Reflexion 去掉自写测试后低于不做反思的基线（[Reflexion](../papers/202303-reflexion.md) Tab. 3），Voyager 去掉自我验证后发现的物品数下降 73%（[Voyager](../papers/202305-voyager.md) §3.4¶1），见[语言反馈强化](../concepts/verbal-reinforcement.md#共识与分歧)。
- 文字反思跨不跨任务：Reflexion 的反思只在同一任务的下一次尝试中读回，记忆最多 1–3 条（[Reflexion](../papers/202303-reflexion.md) §3¶6），作者把扩展到向量库、SQL 数据库留作未来工作（[Reflexion](../papers/202303-reflexion.md) §5¶1）；ACE 把同类教训写进跨任务复用的 playbook（[ACE](../papers/202510-ace.md) §4.1¶1）。本库据此分成[语言反馈强化](../concepts/verbal-reinforcement.md)和[记忆笔记](../concepts/memory-notes.md)两页，同一任务内的反思能否直接提炼成跨任务的规则，还没有素材测过。
- 经验存成文字还是代码：Voyager 存可执行程序，在新世界的未见任务上，带技能库比不带少用 22%–47% 的迭代（本库按 [Voyager](../papers/202305-voyager.md) Tab. 2 计算；不带技能库时钻石镐只有 2/3 次成功）；ACE 存自然语言条目（[ACE](../papers/202510-ace.md) §3.1¶1）。代码要有现成的高层动作 API（[Voyager](../papers/202305-voyager.md) §3.2¶5），文字不受这个限制，两种形式没有素材直接对比过，见[技能库](../concepts/skill-library.md#设计空间)。
- 只改提示词的方法收益能保留多久：换任务分布、换底座模型版本之后，积累的反思和技能还有多少用。谷雨说 NeoCognition 早期把做对的轨迹封装成 reusable skill 的 pipeline，在 Claude Opus 5.5 上已不再需要（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:06:08]）。
- 长程应该怎么测：单个要做半天的难题，还是一串前后依赖、要边做边学的任务。谷雨认为前者难找也难扩展，真正的长程是员工从菜鸟变成老员工的过程（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:08:13]–[00:09:14]），见[连续任务流评测](../concepts/streaming-task-evaluation.md)。
- 与 memory、RSI 的边界：一个 agent 持续积累经验并改进自己，什么时候算记忆，什么时候算学习，什么时候算自我改进。

## 最近进展
