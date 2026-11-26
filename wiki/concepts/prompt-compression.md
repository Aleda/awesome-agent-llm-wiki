---
title: 提示词压缩
type: concept
summary: 在不改目标模型的前提下删减提示词里的 token，只保留目标模型完成任务需要的部分
topics: [context]
aliases: [prompt compression, 提示压缩]
added: 2026-11-27
status: emerging
relations:
  - { topic: context, rel: part-of }
  - { concept: frequent-context-compaction, rel: alternative-to, note: 两者都让每次调用的输入变短；提示词压缩由外部小模型逐 token 删减原文，频繁压缩由执行任务的模型写一份交接摘要后重开对话 }
---

## 定义

来源：[LLMLingua](../papers/202310-llmlingua.md)

在提示词交给目标 LLM 之前把它变短，让目标模型在更短的输入上给出与原输入尽量接近的输出，目标模型本身不改（§3¶1、§1¶1）；按困惑度删 token 是其中一条路线，见设计空间。它要解决的问题是：思维链、few-shot 示例和检索让提示词越来越长，推理成本随之上升（§1¶1）。

它与[频繁上下文压缩](frequent-context-compaction.md)都让输入变短，区别在由谁、怎样删：这里由外部小模型删 token，保留原文的词句；频繁压缩由执行任务的模型自己写摘要。

## 演化

## 设计空间

下表按"谁来决定删什么、删的粒度"比较几种缩短输入的做法。第一行和最后一行取自 LLMLingua 的相关工作和基线，本库没有收录原文。

| 做法 | 谁决定删什么 | 粒度 | 输出可读 | 代价与疑点 |
|---|---|---|---|---|
| 软提示压缩（gist token 等） | 训练出的特殊 token | 整段压成向量 | 否 | 常针对特定任务，有的要微调整个模型（[LLMLingua](../papers/202310-llmlingua.md) §2.1¶2） |
| 按自信息删（Selective-Context） | 小模型 | 短语 | 部分可读 | 不考虑被删内容之间的依赖（[LLMLingua](../papers/202310-llmlingua.md) §1¶3） |
| 由粗到细（LLMLingua） | 对齐过的小模型按困惑度 | 先整段示例、再 token | 人难读，GPT-4 能恢复（[LLMLingua](../papers/202310-llmlingua.md) §5.5¶8） | 小模型太弱时掉点（[LLMLingua](../papers/202310-llmlingua.md) §5.5¶2） |
| LLM 改写摘要 | 大模型 | 整段重写 | 是 | 长度和内容不可控（[LLMLingua](../papers/202310-llmlingua.md) §5.5¶9）；GSM8K 上会漏推理步骤（[LLMLingua](../papers/202310-llmlingua.md) §5.3¶2） |
| [频繁上下文压缩](frequent-context-compaction.md) | 执行任务的模型，按固定模板 | 整段历史换成交接简报 | 是 | 有损（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §3.1¶2）；重开对话使缓存作废（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) Tab. 3） |

[模型自管理上下文](model-managed-context.md#设计空间)那张表按"谁决定上下文怎么变"排列，提示词压缩在其中对应"外部小模型按困惑度删"这一行。

## 共识与分歧

- 生成式压缩靠不靠得住，两份素材看法不同。LLMLingua 作者报告，GSM8K 上让 GPT-4 改写压缩到 20 倍只有 56.33，LLMLingua 是 77.33（[LLMLingua](../papers/202310-llmlingua.md) Tab. 2），并认为生成式压缩会漏掉推理步骤（[LLMLingua](../papers/202310-llmlingua.md) §5.3¶2）。NVIDIA 作者让执行任务的模型自己写交接摘要，报告长程任务准确率大体持平（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §3¶4）。两者压缩的对象不同：LLMLingua 压的是 few-shot 示例里的推理链，NVIDIA 压的是 agent 的历史轨迹，没有直接对照。
- ACE 作者反对把上下文压短：他们认为上下文应当保留详尽的领域策略，由模型在推理时自己挑（[ACE](../papers/202510-ace.md) §1¶4）。他们针对的是跨任务积累的 playbook，LLMLingua 压缩的则是单次调用的输入，见[记忆笔记](memory-notes.md#设计空间)。
- 截至 2026-11，本库唯一来源是 LLMLingua；更早的 Selective-Context 未收录，所以 status 为 emerging。

## 开放问题

- 按困惑度删 token 适用于 agent 轨迹吗？LLMLingua 只测了 few-shot 示例、对话和论文摘要（[LLMLingua](../papers/202310-llmlingua.md) §5.1¶1），工具输出和代码里低困惑度的 token 可能正是后续步骤要用的。
- 压缩后的提示词人读不懂，只有足够强的模型能恢复（[LLMLingua](../papers/202310-llmlingua.md) §5.5¶8）。删掉了什么、是否删错，该怎样审计？
- 输入变短后，[长上下文位置偏差](long-context-position-bias.md)会不会减轻？LLMLingua 保留原有顺序，没有测位置的影响。
