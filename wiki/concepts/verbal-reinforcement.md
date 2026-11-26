---
title: 语言反馈强化
type: concept
summary: 任务失败后让 LLM 把成败信号写成文字反思，放进同一任务下一次尝试的上下文，不改权重地改进做法
topics: [continual-learning]
aliases: [verbal reinforcement, verbal reinforcement learning, 语言强化学习]
added: 2026-11-27
status: established
relations:
  - { topic: continual-learning, rel: part-of }
  - { concept: memory-notes, rel: alternative-to, note: 两者都把从成败反馈中得到的教训写成文字、不改权重地读回；语言反馈强化在同一任务的多次尝试之间传递，记忆笔记跨任务积累 }
---

## 定义

agent 完成一次尝试后，评估器给出成败或分数，再由 LLM 根据轨迹和这个信号写出一段文字反思，指出哪里错了、下次该怎么改；反思存进一小块记忆，在同一任务的下一次尝试中作为上下文读回，模型权重不变（[Reflexion](../papers/202303-reflexion.md) §1¶2、[Reflexion](../papers/202303-reflexion.md) §3¶4）。Reflexion 的作者称之为 verbal reinforcement，把策略看作记忆内容和 LLM 参数的组合（[Reflexion](../papers/202303-reflexion.md) §1¶6）。它要解决的问题是：LLM agent 无法用梯度更新来学习（[Reflexion](../papers/202303-reflexion.md) §1¶1），而环境通常只给一个二值信号，要靠它知道是哪一步出错，就是 credit assignment 问题（[Reflexion](../papers/202303-reflexion.md) §1¶3）。

本库收录的最早来源是 2023-03 的 Reflexion。作者在相关工作里把 Self-Refine 等自我修改方法区分为只适用于单次生成（[Reflexion](../papers/202303-reflexion.md) §2¶1），本库没有收录这些方法的原文。

**为什么单独建页，不并入[记忆笔记](memory-notes.md)**（录入 Reflexion 全文后的判断，2026-11-27）。两者都把教训写成文字、权重不变，区别在读回的时机和范围：

- Reflexion 的反思在"后续的尝试"里读回（[Reflexion](../papers/202303-reflexion.md) §3¶4）。ALFWorld 上每次反思后重置环境、重新开始同一任务（[Reflexion](../papers/202303-reflexion.md) §4.1¶1）；HotPotQA 上失败的题一直重试，直到同一道题连续失败 3 次（[Reflexion](../papers/202303-reflexion.md) §4.2¶3）；附录的例子标明是"同一环境和任务"的两次尝试（[Reflexion](../papers/202303-reflexion.md) Fig. 7）。
- 记忆只留最近 1–3 条（[Reflexion](../papers/202303-reflexion.md) §3¶6），编程任务只留 1 条（[Reflexion](../papers/202303-reflexion.md) §4.3¶2），内容针对具体题目。
- 作者说反思可以存进长期记忆（[Reflexion](../papers/202303-reflexion.md) §1¶3），并建议将来换成向量库或 SQL 数据库（[Reflexion](../papers/202303-reflexion.md) §5¶1），但论文全文没有一个实验测反思能否帮到另一个任务。
- 记忆笔记的定义要求读回用于之后的其他任务，评测的也是后续任务做得好不好（[ACE](../papers/202510-ace.md) §4.1¶1）。

所以本库把 Reflexion 记为这一页的 `proposes`，不记为记忆笔记的最早来源，两页之间用 `alternative-to` 相连。跨任务复用反思，是从这一页走到记忆笔记的那一步。

## 演化

## 设计空间

下表按"下一次尝试能看到什么"排列，前四行取自 Reflexion 的基线和消融，第五行取自 Voyager，后两行是对照。

| 做法 | 下一次尝试能看到什么 | 结果 | 代价与疑点 |
|---|---|---|---|
| 直接重试 | 什么都不留 | ALFWorld 上 ReAct 自身重试在第 6–7 次之间停止提升（[Reflexion](../papers/202303-reflexion.md) §4.1¶3）；HotPotQA 上基线解不出任何第一次失败的题（[Reflexion](../papers/202303-reflexion.md) §4.2¶3） | 只能靠采样的随机性 |
| 附上一条轨迹 | 上一次的完整轨迹 | HotPotQA 上比加反思低 8 个点（[Reflexion](../papers/202303-reflexion.md) §4.2¶4） | 轨迹长，模型要自己找出错误 |
| 只给执行反馈 | 单元测试结果，不写反思 | HumanEval Rust 最难 50 题上 0.60，与基线相同（[Reflexion](../papers/202303-reflexion.md) Tab. 3） | 测试和编译能发现错误，修复却没有跟上（[Reflexion](../papers/202303-reflexion.md) §4.3¶6） |
| 文字反思 | 评估器的信号加 LLM 写的反思，最多 1–3 条 | 同一设置 0.68（[Reflexion](../papers/202303-reflexion.md) Tab. 3）；ALFWorld 130/134（[Reflexion](../papers/202303-reflexion.md) §4.1¶3） | 依赖评估信号可靠；去掉自写测试后降到 0.52（[Reflexion](../papers/202303-reflexion.md) Tab. 3） |
| 评估和建议合一的 critic | 另一个 GPT-4 判断是否完成，失败时写建议，与环境反馈、执行错误一起给下一轮（[Voyager](../papers/202305-voyager.md) §2.3¶1） | Minecraft 上去掉它，发现的物品数下降 73%（[Voyager](../papers/202305-voyager.md) §3.4¶1） | critic 会误判，如不认蜘蛛丝是打败蜘蛛的证据（[Voyager](../papers/202305-voyager.md) §4¶2） |
| 对照：跨任务的笔记 | 之前其他任务积累的规则和教训 | 见[记忆笔记](memory-notes.md#设计空间) | 不属于本概念 |
| 对照：对经历的周期性反思 | 对人和事的高层推断 | 见[记忆流与反思](memory-stream-reflection.md) | 不针对任务成败，不属于本概念 |

## 共识与分歧

- 评估信号是整套方法的瓶颈，两篇素材在这点上一致。Reflexion 去掉自写测试后低于基线（[Reflexion](../papers/202303-reflexion.md) Tab. 3），测试误报率 16.3% 的 MBPP Python 上低于 GPT-4（[Reflexion](../papers/202303-reflexion.md) §4.3¶4）；Voyager 的消融里自我验证是三种反馈中最重要的（[Voyager](../papers/202305-voyager.md) §3.4¶1）。
- 信号从哪来，各实验差别很大：Reflexion 的 HotPotQA 用对照标准答案的精确匹配（[Reflexion](../papers/202303-reflexion.md) §4.2¶2），ALFWorld 由环境报告是否完成、用启发式规则判断何时算失败（[Reflexion](../papers/202303-reflexion.md) §4.1¶1），编程用模型自写的测试（[Reflexion](../papers/202303-reflexion.md) §4.3¶2），Voyager 用另一个 LLM 判断（[Voyager](../papers/202305-voyager.md) §2.3¶1）。用标准答案判断时，结果更接近"告诉你错了、允许重答"的上限，不能直接推到没有标签的场景。
- 要先有一个可以重试的具体任务。在 Minecraft 里只给"尽量多探索"这种抽象目标时，改写成基线的 Reflexion 几乎没有进展（[Voyager](../papers/202305-voyager.md) §3.3¶2），连木制工具都没解锁（[Voyager](../papers/202305-voyager.md) Tab. 1）；Voyager 由自动课程逐个给出具体任务，反馈才有对象。
- Voyager 作者认为自己的自我验证同时检查成败、反思错误，比 Reflexion 的自我反思更全面（[Voyager](../papers/202305-voyager.md) §2.3¶1）。本库判断：Reflexion 本来就有独立的评估器（[Reflexion](../papers/202303-reflexion.md) §3¶1），两者的差别在评估和写建议是否由同一个模型调用完成。
- 与 Generative Agents 的反思：同叫"反思"，Generative Agents 按重要性累计周期性触发，概括对人和事的推断（[Generative Agents](../papers/202304-generative-agents.md) §4.2¶2）；这里的反思在任务失败后触发，写的是下次怎样改（[Reflexion](../papers/202303-reflexion.md) §3¶4）。本库分开建页，见[记忆流与反思](memory-stream-reflection.md#共识与分歧)。

## 开放问题

- 没有可靠成败信号时还能不能用？Reflexion 承认它依赖 LLM 的自我评估或启发式规则（[Reflexion](../papers/202303-reflexion.md) §1¶4），测试误报会让 agent 过早提交错误答案（[Reflexion](../papers/202303-reflexion.md) §4.3¶4）。
- 写出有用的反思需要多强的模型？starchat-beta 上 Reflexion 没有任何提升（[Reflexion](../papers/202303-reflexion.md) Tab. 4）。
- 需要大量探索的任务怎么办？WebShop 上反思没有帮助（[Reflexion](../papers/202303-reflexion.md) Fig. 6），作者认为方法仍可能陷入局部最优（[Reflexion](../papers/202303-reflexion.md) §5¶1）。
- 同一任务里写出的反思，能否提炼成对其他任务也有用的规则？这是本页和[记忆笔记](memory-notes.md)的接口，Reflexion 没有测。
- 反思是可读的文字，作者认为可以在 agent 使用工具前检查它的意图（[Reflexion](../papers/202303-reflexion.md) §6¶2）；这能否成为一种监督手段，论文没有实验。
