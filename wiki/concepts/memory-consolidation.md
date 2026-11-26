---
title: 写入时记忆整合
type: concept
summary: 新信息写入时取出相似旧记忆，由 LLM 决定新增、改写、合并或删除，让记忆库保持一致
topics: [memory]
aliases: [memory consolidation, write-time memory consolidation, memory evolution, 记忆演化, memory update operations]
added: 2026-11-27
status: established
relations:
  - { topic: memory, rel: part-of }
---

## 定义

每当新信息要写入长期记忆，先按相似度取出若干条已有记忆，再让 LLM 决定怎样把新信息并进去：新增一条、补充或改写旧条目、合并重复、删除被推翻的内容，或者什么都不做。它要解决的问题是：只追加的记忆库会越积越大、互相重复和矛盾，检索时把这些负担留给读取的那一刻；整合把这部分工作挪到写入时完成。A-MEM 称之为记忆演化，新记忆会触发旧记忆的描述和属性更新（[A-MEM](../papers/202502-a-mem.md) §1¶5）；Mem0 称之为更新阶段，由 LLM 在 ADD、UPDATE、DELETE、NOOP 四种操作中选择（[Mem0](../papers/202504-mem0.md) §2.1¶3）。Mem0 作为系统早于 A-MEM 论文，A-MEM 已把它当作依赖图数据库的已有方案引用（[A-MEM](../papers/202502-a-mem.md) §1¶2）；本库按素材的发表日期排演化，所以最早来源记为 A-MEM。

## 演化

## 设计空间

下表比较本库收录的几种长期记忆维护方式，按"写入时改不改旧记忆"排列。前两行是对照，不属于本概念。

| 做法 | 代表 | 写入时做什么 | 旧记忆会不会变 | 谁决定何时写 | 代价与疑点 |
|---|---|---|---|---|---|
| 只追加 + 反思 | [记忆流与反思](memory-stream-reflection.md)（[Generative Agents](../papers/202304-generative-agents.md) §4.1¶2） | LLM 打重要性分；累计过阈值时写一条新的反思（[Generative Agents](../papers/202304-generative-agents.md) §4.2¶2） | 不变，反思作为新条目追加（[Generative Agents](../papers/202304-generative-agents.md) §4.2¶3） | 系统：每个观察都写入 | 记忆越多越难检索（[Generative Agents](../papers/202304-generative-agents.md) §7.2¶1） |
| 模型自主读写 | [MemGPT](../papers/202310-memgpt.md) | 模型在对话中用函数调用把内容存进 working context 或 archival storage（[MemGPT](../papers/202310-memgpt.md) §2.2¶2） | working context 可被模型改写（[MemGPT](../papers/202310-memgpt.md) §2.1¶1） | 模型，系统按 token 阈值提醒（[MemGPT](../papers/202310-memgpt.md) §2.2¶2） | 依赖模型的函数调用能力（[MemGPT](../papers/202310-memgpt.md) §3.2.1¶6）；见[模型自管理上下文](model-managed-context.md) |
| 链接 + 演化 | [A-MEM](../papers/202502-a-mem.md) | LLM 生成关键词、标签和描述，与 top-k 近邻建链（[A-MEM](../papers/202502-a-mem.md) §3.2¶1） | 近邻的描述、关键词、标签被改写并替换（[A-MEM](../papers/202502-a-mem.md) §3.3¶1） | 系统：每条新记忆都走一遍 | 组织质量受模型能力限制（[A-MEM](../papers/202502-a-mem.md) §6¶1）；改写不留原版本 |
| 抽取 + 四选一 | [Mem0](../papers/202504-mem0.md) | LLM 从新一轮对话抽事实，对每条事实和 10 条相似记忆选 ADD/UPDATE/DELETE/NOOP（[Mem0](../papers/202504-mem0.md) §2.1¶3、§2.1¶4） | 可以被补充或删除（[Mem0](../papers/202504-mem0.md) §2.1¶3） | 系统：每对消息都走一遍 | 误删无法找回，论文没有评估 |
| 图 + 标记失效 | Mem0^g（[Mem0](../papers/202504-mem0.md) §2.2¶5） | 抽实体和关系三元组，并入已有节点 | 冲突关系标为失效，不物理删除（[Mem0](../papers/202504-mem0.md) §2.2¶5） | 系统 | 单跳、多跳不如纯文本版（[Mem0](../papers/202504-mem0.md) §4.2¶1） |

## 共识与分歧

- 共识：两篇都在写入时先按向量相似度取近邻，再由 LLM 决定怎样改动已有记忆（[A-MEM](../papers/202502-a-mem.md) §3.2¶1、[Mem0](../papers/202504-mem0.md) §2.1¶3）。反对预先定好记忆结构的是 A-MEM 作者，他们正把 Mem0 的图数据库方案当作反例（[A-MEM](../papers/202502-a-mem.md) §1¶2）。
- 分歧在改旧记忆改到什么程度。A-MEM 只改描述、标签和链接，原始内容保留（[A-MEM](../papers/202502-a-mem.md) §3.3¶1）；Mem0 会删掉被推翻的事实（[Mem0](../papers/202504-mem0.md) §2.1¶3）；Mem0 的图变体为了时间推理改为标记失效（[Mem0](../papers/202504-mem0.md) §2.2¶5），作者报告它在时间类问题上 J 分最高（[Mem0](../papers/202504-mem0.md) Tab. 1）。
- 整合与全文的取舍：Mem0 在 LOCOMO 上 J 分 66.88，低于把整段对话放进上下文的 72.90，p95 延迟从 17.117 秒降到 1.440 秒（[Mem0](../papers/202504-mem0.md) Tab. 2）。整合省的是读取时的延迟和 token，准确率的上限仍是全文。
- 本库判断：两篇在 LoCoMo 上的分类结果不能直接对照。同一组 A-MEM 数字出现过三套类别标签：A-MEM 早期版本、本库缓存的 v11（[A-MEM](../papers/202502-a-mem.md) Tab. 1）和 Mem0 的引用（[Mem0](../papers/202504-mem0.md) Tab. 1）各不相同，详见 A-MEM 页「局限与疑点」；Mem0 重跑 A-MEM 得到的 F1 也低于原文报告值（[Mem0](../papers/202504-mem0.md) Tab. 1）。两篇的数字都是作者自测。

## 开放问题

- LLM 改写或删除旧记忆时出错的比例有多高？错误一旦写入，后续检索都会读到它，两篇都没有测。
- 写入时付出的 LLM 调用成本和读取时省下的成本怎样权衡？A-MEM 只报告了单次写入的价格和耗时（[A-MEM](../papers/202502-a-mem.md) §4.3¶2），Mem0 报告的 token 是读取一侧的（[Mem0](../papers/202504-mem0.md) Tab. 2）。
- 整合存的是事实和描述，评测问的也是"能否答对关于过往对话的问题"（[Mem0](../papers/202504-mem0.md) §3.1¶1）。有了这类记忆，后续任务会不会做得更好，需要[连续任务流评测](streaming-task-evaluation.md)一类的设置来测。
- 何时写由系统固定（每轮都跑），还是交给模型决定（MemGPT 的做法）？A-MEM、Mem0 都在 LoCoMo 上和 MemGPT 比过（[A-MEM](../papers/202502-a-mem.md) Tab. 1、[Mem0](../papers/202504-mem0.md) Tab. 1），但存储结构、提示和评分都不同，还没有只改变"何时写"这一项的对照实验。
