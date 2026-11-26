---
title: 记忆流与反思
type: concept
summary: 把全部经历按时间记成自然语言流，按近因、重要性、相关性取回，并定期提炼出更高层的反思写回
topics: [memory]
aliases: [memory stream, memory stream with reflection, reflection, 记忆流, 反思记忆, recency-importance-relevance retrieval]
added: 2026-11-27
status: emerging
relations:
  - { topic: memory, rel: part-of }
  - { concept: memory-consolidation, rel: alternative-to, note: 两者都在写入时用 LLM 加工记忆；记忆流只追加，靠检索打分和反思应对增长，写入时整合会改写或删除旧条目 }
---

## 定义

来源：[Generative Agents](../papers/202304-generative-agents.md)

agent 的全部经历按时间顺序记成一条自然语言记录流，每条带创建时间和最近访问时间（§4.1¶2）；每一步按近因、重要性、相关性三项打分，取排在前面的记忆放进 prompt（§1¶4）；重要性累计过阈值时，让 LLM 根据最近的记忆提出问题、检索证据，写出更高层的推断作为"反思"存回流中（§4.2¶2、§4.2¶3）。它要解决的问题是：经历远多于 prompt 能放下的量，压成摘要会丢掉具体信息（§4.1¶1），而只有原始观察的 agent 又不会概括（§4.2¶1）。

## 演化

## 设计空间

来源：[Generative Agents](../papers/202304-generative-agents.md)

同一篇论文的消融把记忆流拆成几层，下表按访谈可信度的 TrueSkill 均值排列（§6.5.1¶1）。

| 能读到什么 | TrueSkill μ | 说明 |
|---|---|---|
| 什么都读不到（无观察、无反思、无计划） | 21.21 | 作者认为它代表此前的 LLM agent（§6.2¶1） |
| 只有观察 | 25.64 | 记得事，但对"想和谁共度一小时"只会选见面最多的人（§4.2¶1） |
| 观察 + 计划 | 26.88 | 行为前后一致，但缺少概括 |
| 观察 + 计划 + 反思 | 29.89 | 能回答需要综合经历的问题（§6.5.3¶1） |

与其他记忆路线的比较见[写入时记忆整合](memory-consolidation.md#设计空间)：记忆流只追加，后者在写入时改写或删除旧条目。

## 共识与分歧

- 与[记忆笔记](memory-notes.md)的区别：两者都把经验写成自然语言再读回。反思存的是对人和事的推断（例如"Klaus 专注于研究"），服务于角色行为的可信度（[Generative Agents](../papers/202304-generative-agents.md) §6.1¶1）；记忆笔记存的是跨任务积累的做事规则和教训，目的是让后续任务做得更好。本库因此分开建页。
- 与 Reflexion 的区别：Reflexion 把任务失败的原因写成文字，供同一任务的下一次尝试参考；这里的反思不针对任务成败，按重要性累计周期性触发，概括的是经历本身。Reflexion 的素材待录入。
- 截至 2026-11，本库只有 Generative Agents 一个来源。

## 开放问题

来源：[Generative Agents](../papers/202304-generative-agents.md)

- 记忆流只增不减，作者观察到记忆增长后检索和决策都变难（§7.2¶1）。需要遗忘或合并，还是更好的检索就够？
- 重要性在写入时打分后不再变（§4.1¶5），之后才显出重要性的事件怎么办？
- 反思建立在可能被添油加醋的记忆上（§6.5.2¶3），写错的反思如何发现和纠正？
- 三项权重都设为 1（§4.1¶7），作者把调整检索函数列为未来工作（§8.2¶1）；权重是否应当随任务或由模型决定？
