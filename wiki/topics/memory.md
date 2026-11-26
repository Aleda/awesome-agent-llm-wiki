---
title: Memory
type: topic
summary: 跨会话、跨任务保存和取回信息：存什么、怎么组织、何时读写
aliases: [记忆, agent memory]
added: 2026-11-26
order: 2
---

## 这个方向在解决什么

LLM 的权重在部署后固定，两次调用之间不保留任何状态。agent 要在多次会话或很长的任务中保持连续，只能把信息存到模型之外，在需要时再取回放进上下文。难点有三处：哪些信息值得写入，写入后如何组织才能在需要时被检索到，旧信息过时或互相矛盾时如何更新。memory 方向关心存储和取回的机制；这些记录能否让 agent 在之后的任务上持续变好，归 continual learning 方向。

## 概念地图

### 记忆的结构

- 分层记忆：仿照操作系统的内存与外存，让模型在上下文和外部存储之间换入换出（[MemGPT](../papers/202310-memgpt.md)）。本库把它归在[模型自管理上下文](../concepts/model-managed-context.md)下，和 context 方向的 CLM 放在同一张设计空间表里比较。
- [记忆流与反思](../concepts/memory-stream-reflection.md)：按时间记录全部观察，按近因、重要性、相关性取回，定期提炼成更高层的反思写回（[Generative Agents](../papers/202304-generative-agents.md)）。
- [写入时记忆整合](../concepts/memory-consolidation.md)：新记忆写入时取出相似旧记忆，由 LLM 决定建链、改写、合并或删除（[A-MEM](../papers/202502-a-mem.md)、[Mem0](../papers/202504-mem0.md)）；Mem0 的图变体把记忆存成实体关系图。
- [记忆笔记](../concepts/memory-notes.md)：与上面几类存事实、存观察的结构不同，它存的是跨任务学到的规则和教训（程序性经验），由模型反复改写，目的是让后续任务做得更好；它同时属于 continual learning 方向。A-MEM、Mem0 的笔记和增删改操作归入写入时记忆整合，不归入这一页。

### 读写策略

- 写入：由规则触发，还是由模型决定何时写、写什么。MemGPT 让模型用函数调用决定（[MemGPT](../papers/202310-memgpt.md) §2.3¶1）；A-MEM、Mem0 对每条新信息都跑一遍固定管线，模型只决定怎样改（[Mem0](../papers/202504-mem0.md) §2.1¶3）。
- 检索：按相关性、时间和重要性打分取回，见[记忆流与反思](../concepts/memory-stream-reflection.md)。
- 更新与遗忘：合并重复条目、覆盖过时内容、处理冲突，见[写入时记忆整合](../concepts/memory-consolidation.md#设计空间)。

### 记忆的类型

- 情节记忆（发生过什么）、语义记忆（知道什么）、程序性记忆（会做什么）。

## 关键争论

- 模型管理还是外部系统管理：读写记忆的决策由模型自己做，还是由外部系统按规则做。这与 context 方向的同类争论是同一个问题。MemGPT 把读写时机交给模型，但何时腾空间仍由系统按 token 阈值触发（[MemGPT](../papers/202310-memgpt.md) §2.2¶2）；Generative Agents 由固定打分函数决定取回什么（[Generative Agents](../papers/202304-generative-agents.md) §4.1¶7）。两条路线还没有在同一个 benchmark 上对比过，见[模型自管理上下文](../concepts/model-managed-context.md#设计空间)。
- 记忆库要不要改旧条目：Generative Agents 的记忆流只追加（[Generative Agents](../papers/202304-generative-agents.md) §4.2¶3），A-MEM 改写近邻笔记的描述和标签（[A-MEM](../papers/202502-a-mem.md) §3.3¶1），Mem0 删除被推翻的事实（[Mem0](../papers/202504-mem0.md) §2.1¶3），而 Mem0 的图变体为了时间推理只标记失效（[Mem0](../papers/202504-mem0.md) §2.2¶5）。改得越多，记忆越紧凑，写错的代价也越难挽回，三篇都没有测改错的比例，见[写入时记忆整合](../concepts/memory-consolidation.md#共识与分歧)。
- 记忆系统和把全文放进上下文比：Mem0 作者报告，LOCOMO 上整段对话放进上下文的 J 分仍然最高（72.90），Mem0 是 66.88，换来 p95 延迟从约 17 秒降到约 1.4 秒（[Mem0](../papers/202504-mem0.md) Tab. 2）。MemGPT 的对话实验没有和完整历史比，基线只拿到摘要（[MemGPT](../papers/202310-memgpt.md) §3.1.1¶3）。
- 检索够不够：向量检索能否应付需要跨多条记忆推理的情形，还是需要显式的结构（图、层级）。
- 怎么评测：现有评测多测"能否记起某个事实"，较少测"有了记忆后续任务是否做得更好"。本库收录的四篇记忆论文都属于前一类：Generative Agents 测访谈回答的可信度（[Generative Agents](../papers/202304-generative-agents.md) §6.1¶1），MemGPT、A-MEM、Mem0 测关于过往对话的问答（[MemGPT](../papers/202310-memgpt.md) §3.1.1¶1、[A-MEM](../papers/202502-a-mem.md) §4.1¶1、[Mem0](../papers/202504-mem0.md) §3.1¶1）。A-MEM 和 Mem0 都用 [LoCoMo](../glossary.md#locomo)，但两篇对数据集规模和问题类别的描述对不上（[A-MEM](../papers/202502-a-mem.md) §4.1¶1、[Mem0](../papers/202504-mem0.md) §3.1¶1）。后一类的一种设计是[连续任务流评测](../concepts/streaming-task-evaluation.md)。
- 产品层的连续性：NeoCognition 联创谷雨认为 personal agent 要做成一个持续存在的单一会话，按 session 开窗口的方式不适合做助手（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:36:42]）。本库判断：按他的说法，跨会话连续性有一部分取决于产品形态，不全是模型和记忆系统的能力问题。

## 最近进展
