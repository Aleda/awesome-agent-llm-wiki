---
title: 记忆笔记
type: concept
summary: 模型把跨任务学到的规则和教训写成笔记并反复改写，让后续任务做得更好
topics: [continual-learning, memory, context]
aliases: [memory notes, 经验笔记, notes-based continual learning, 记忆笔记式持续学习, evolving playbook]
added: 2026-11-27
status: established
relations:
  - { topic: continual-learning, rel: part-of }
  - { topic: memory, rel: part-of }
  - { topic: context, rel: part-of }
---

## 定义

模型把跨任务学到的经验和做法，即规则、教训和处理某类事的流程，写成自然语言笔记，并在之后的任务中不断改写或补充，读回使用，目的是让后续任务做得更好；权重不变，经验存在笔记里。它存的是程序性经验，存事实的记忆另归一类。它要解决的问题是：部署后的 agent 怎样在不重新训练的情况下，从之前的任务中持续变好。谷雨用的说法是"通过 rewrite memory notes 的方式做 continual learning"（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:16:18]）。本库收录的最早论文来源是 2025-10 的 ACE：作者把系统提示和 agent 记忆当作逐条积累的 playbook，条目是可复用的策略、领域概念和常见失败模式（[ACE](../papers/202510-ace.md) §3.1¶1），跨 episode 复用（[ACE](../papers/202510-ace.md) §4.1¶1），称之为 context adaptation，并把它看作不改权重的持续学习方式（[ACE](../papers/202510-ace.md) §5¶1）。ACE 不是这一想法的首次提出：它以更早的 Dynamic Cheatsheet 为基线，后者在推理中积累过去成败的策略和教训（[ACE](../papers/202510-ace.md) §2.1¶1），本库尚未收录原文，所以 ACE 记为 `extends`。

边界，以及和相关素材的关系（A-MEM、Mem0、MemGPT、Generative Agents、ACE 已按全文核对，2026-11-27）：

- ACE 的 playbook 属于这一页：它存的是从执行反馈里提炼的策略和失败模式（[ACE](../papers/202510-ace.md) §3¶1），评测的是之后的任务做得好不好（[ACE](../papers/202510-ace.md) Tab. 1）。它和这一页原来的描述有一处不同：作者反对整份改写笔记，只追加或局部更新条目（[ACE](../papers/202510-ace.md) §3.1¶3）。本库不为它另开"演化式上下文"一页，因为解决的是同一个问题，差别在更新方式，放在下面的设计空间里比较。
- 存事实、存观察的记忆不属于这一页。A-MEM 的笔记存的是交互内容本身，加上 LLM 生成的关键词、标签和描述（[A-MEM](../papers/202502-a-mem.md) §3.1¶1）；Mem0 存的是从对话里抽出的事实，写入时由 LLM 选 ADD、UPDATE、DELETE 或 NOOP（[Mem0](../papers/202504-mem0.md) §2.1¶3）。两篇评测的都是能否答对关于过往对话的问题，没有测后续任务是否因此做得更好，所以都不挂到这一页，归入[写入时记忆整合](memory-consolidation.md)。
- MemGPT 的自编辑记忆在对话中用来存用户和人设的关键事实（[MemGPT](../papers/202310-memgpt.md) §2.1¶1），论文没有跨任务积累做事经验的实验，所以不挂关系。它的贡献是让模型自己决定上下文里放什么，归入[模型自管理上下文](model-managed-context.md)；这套机制可以用来承载记忆笔记，下文设计空间只作对照。
- Generative Agents 的反思也是把经验写成文字再读回，但存的是对人和事的推断，服务于角色可信度（[Generative Agents](../papers/202304-generative-agents.md) §6.1¶1），所以单独建为[记忆流与反思](memory-stream-reflection.md)，不挂到这一页。
- Reflexion 把失败原因写成文字反思，供同一任务的下一次尝试参考；这里的笔记跨任务留存。Reflexion（2023-03）早于本页现有的全部来源，录入时按全文判断它是首次提出这一想法，还是另一个概念。
- [模型自管理上下文](model-managed-context.md)里 CLM 的 notes 角色记的是当前任务的进度，任务结束就不再需要，与这里跨任务留存的笔记不同。

## 演化

## 设计空间

下表按经验存放的位置和笔记的更新方式比较几条路线。前两行是记忆笔记内部的两种更新方式，取自 ACE 论文；改权重和技能库两行取自 [Continual Learning](../topics/continual-learning.md) 主题页的分类，对应素材待录入；最后一行是对照，不属于本概念。

| 路线 | 经验存在哪里 | 优点 | 代价与疑点 |
|---|---|---|---|
| 记忆笔记，整份重写 | 自然语言笔记，每一步由 LLM 重写全文（Dynamic Cheatsheet，[ACE](../papers/202510-ace.md) §2.2¶2） | 不训练、可读 | 可能塌缩：AppWorld 上 18,282 token 的笔记一步变成 122 token，准确率低于不做适应（[ACE](../papers/202510-ace.md) §2.2¶2）；谷雨认为改写笔记不是可靠的优化算法（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:16:18]） |
| 记忆笔记，逐条增量更新 | 带 ID 和有用/有害计数的条目；LLM 只写新增条目，合并、去重由确定性逻辑完成（[ACE](../papers/202510-ace.md) §3¶3、[ACE](../papers/202510-ace.md) §3.1¶1） | 不会一次清空旧知识；AppWorld 上比去掉增量更新的同一方法高 13.4 个点（[ACE](../papers/202510-ace.md) Tab. 18） | 只增不删，过时条目靠去重和超长修剪处理（[ACE](../papers/202510-ace.md) §3.2¶1）；依赖 Reflector 的质量（[ACE](../papers/202510-ace.md) §5¶2） |
| 技能库 | 可调用的代码或封装好的 skill | 成功行为可以直接复用 | NeoCognition 早期把做对的轨迹封装成 reusable skill，谷雨说 Opus 5.5 已能自己完成这套流程（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:06:08]） |
| 改权重 | 模型参数 | 经验内化，不占上下文 | 训练成本和灾难性遗忘 |
| 训练模型写笔记 | 笔记仍在外部，但写笔记的能力进权重 | 两者结合 | 谷雨说 OpenAI 和 Anthropic 各有 recipe，但还不成熟（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:11:14]） |
| 对照：模型自编辑的工作记忆 | 上下文里一块固定大小、只能由模型通过函数调用改写的区域（[MemGPT](../papers/202310-memgpt.md) §2.1¶1） | 可以承载笔记，读写时机由模型决定 | MemGPT 只在对话和文档分析两类任务上评测（[MemGPT](../papers/202310-memgpt.md) §3），没有测跨任务的经验积累 |

## 共识与分歧

来源：[十字路口 / 对话谷雨](../podcasts/20261108-crossing-gu-yu.md)

- 谷雨 2026 上半年公开认为这种方式不靠谱，理由是改写笔记不是一个 reliable 的 optimization algorithm（[00:16:18]）。
- 他在 2026-11 修正为：仍不可靠，但上限被低估了；之前的主要问题是笔记质量被模型自身能力卡住，模型变强后上限可能相当可观（[00:16:18]–[00:17:18]）。
- 谷雨认为提升 continual learning 最重要的数据是让模型更好地写 memory notes 的数据，Claude Code、Codex 这类 long session 可能天然带有这种数据（[00:11:14]）；他说截至 2026-11 只有 Anthropic 和 OpenAI 做得好（[00:17:18]）。
- "只有两家做得好"是谷雨的观察，来源方的公司做 continual learning，依据包括他公司未公开的 benchmark（[00:12:15]），外部无法复核。
- 谷雨说改写笔记"不可靠"，ACE 给出了一种具体的失败方式和一个补救。作者报告让 LLM 每一步整份重写笔记，内容会越写越短，最终突然塌缩（[ACE](../papers/202510-ace.md) §2.2¶2）；改成只追加、局部更新条目后，AppWorld test-normal 平均从 56.9 升到 70.3（[ACE](../papers/202510-ace.md) Tab. 18）。两者说的"不可靠"不完全是一回事：谷雨指的是笔记质量受模型能力限制（[00:16:18]–[00:17:18]），ACE 指的是重写这一更新操作本身会丢信息，ACE 同样承认依赖反思模型的能力（[ACE](../papers/202510-ace.md) §5¶2）。
- 笔记要不要压短也有分歧。ACE 作者认为笔记应当越积越全，让模型自己挑（[ACE](../papers/202510-ace.md) §1¶4）；[长上下文位置偏差](long-context-position-bias.md)的研究显示模型对长输入中间部分的利用较差，ACE 没有测条目在 playbook 中的位置是否影响效果。

## 开放问题

- 笔记改写既然不是可靠的优化算法，怎样防止错误经验被写进笔记后一直留存？ACE 在没有可靠反馈的金融任务上，在线适应后反而低于基础模型（[ACE](../papers/202510-ace.md) Tab. 2），作者认为是上下文被误导信号污染（[ACE](../papers/202510-ace.md) §4.4¶2）。
- 笔记的收益是否随底座模型更换而保留？
- 写笔记的能力能否像谷雨设想的那样通过训练数据提高，需要什么样的数据（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:11:14]）？
