---
title: "Reflexion: Language Agents with Verbal Reinforcement Learning"
type: paper
summary: 把失败反馈写成文字反思存进记忆，同一任务下一次尝试时读回，不改权重，HumanEval pass@1 达 91%
topics: [continual-learning, agent]
aliases: [Reflexion]
added: 2026-11-27
date: 2023-03-20
url: https://arxiv.org/abs/2303.11366
source_dir: sources/papers/2303.11366
venue: NeurIPS 2023
code: https://github.com/noahshinn024/reflexion
pages: 19
by:
  - { entity: northeastern, role: org }
  - { entity: mit, role: org }
  - { entity: princeton, role: org }
  - { name: Noah Shinn, role: author }
  - { name: Federico Cassano, role: author }
  - { name: Edward Berman, role: author }
  - { name: Ashwin Gopinath, role: author }
  - { name: Karthik Narasimhan, role: author }
  - { name: Shunyu Yao, role: author }
relations:
  - { concept: verbal-reinforcement, rel: proposes, note: 把环境给的二值或标量成败信号交给 LLM 写成文字反思，存进最多 1–3 条的记忆，作为同一任务下一次尝试的上下文；作者称之为 verbal reinforcement，权重不变 }
  - { concept: interleaved-reasoning-acting, rel: applies, note: ALFWorld 和 HotPotQA 上用 ReAct 作为 Actor，反思写进记忆后在下一条 ReAct 轨迹里读回 }
---

## 新认知

- **Reflexion 把强化学习里的标量奖励换成 LLM 写的一段文字反思，存进记忆，在同一任务的下一次尝试中作为上下文读回，作者把这样的策略看作"记忆内容加 LLM 参数"，称之为 verbal reinforcement（§1¶2、§1¶6）**，本库据此新建[语言反馈强化](../concepts/verbal-reinforcement.md)并把 Reflexion 记为最早来源。
- **它和[记忆笔记](../concepts/memory-notes.md#定义)管的是不同范围：所有实验都在同一任务的多次尝试之间读回反思（§4.1¶1、§4.2¶3、Fig. 7），记忆只留最近 1–3 条（§3¶6），论文没有测反思能否帮到另一个任务**，所以本库不把它记为记忆笔记的最早来源。
- 反思的增量要和"重看上一条轨迹"分开算：HotPotQA 上在只附上一条轨迹的对照组之上再加反思，又高 8 个点（§4.2¶4）；HumanEval Rust 最难的 50 题上只看测试反馈、不写反思，结果与基线同为 0.60（Tab. 3），见[语言反馈强化](../concepts/verbal-reinforcement.md#设计空间)。
- 成败信号从哪来决定了结论能推多远：HotPotQA 用对照标准答案的精确匹配判断对错（§4.2¶2），ALFWorld 由环境报告任务是否完成、用启发式规则或 LLM 分类判断何时算失败（§4.1¶1），只有编程任务靠模型自己写的单元测试（§4.3¶2），见[语言反馈强化](../concepts/verbal-reinforcement.md#共识与分歧)。
- **HumanEval Python pass@1 91.0，单次采样的 GPT-4 是 80.1（Tab. 1），但收益取决于自写测试是否可靠：MBPP Python 上测试误报率 16.3%，Reflexion 的 77.1 反而低于 GPT-4 的 80.1（§4.3¶4、Tab. 1）**，见[语言反馈强化](../concepts/verbal-reinforcement.md#开放问题)。
- 写出有用反思的能力要靠强模型：starchat-beta 上 Reflexion 与基线同为 0.26（Tab. 4），作者也承认方法依赖 LLM 自我评估的能力（§1¶4），见[语言反馈强化](../concepts/verbal-reinforcement.md#开放问题)。
- 需要大量探索的任务上反思帮不上忙：WebShop 上 ReAct + Reflexion 没有明显超过 ReAct（Fig. 6），作者把这归为策略优化可能陷入局部最优（§5¶1），见[语言反馈强化](../concepts/verbal-reinforcement.md#开放问题)。
- 这里的"反思"针对的是一次任务为什么失败、下次该换哪个动作（§3¶4），与 Generative Agents 概括人和事的反思同名不同事，见[记忆流与反思](../concepts/memory-stream-reflection.md#共识与分歧)。

## 核心问题

基于 LLM 的 agent 参数太多，用梯度下降做强化学习需要大量算力和时间，所以此前只能靠上下文里的示例来教（§1¶1）。agent 因此很难从自己的试错中学：环境通常只给一个成败信号，要知道是哪一步出错，就是强化学习里的 credit assignment 问题（§1¶3）。本质上这是不能更新权重时的策略改进问题：要把一次失败变成下一次可执行的改进方向，而这个方向只能写进上下文。

## 核心洞察

LLM 能把一条失败轨迹和一个二值信号"放大"成具体的文字建议，例如指出哪一步动作导致后面全错、下次应该换成什么（§1¶3、§3¶4）。把这段文字放进下一次尝试的上下文，就起到一次策略更新的作用，作者称它是"语义梯度"（§1¶2）。

## 核心设计

1. **三个模型分工**：Actor 生成文本和动作，可以是 CoT 或 ReAct（§3¶2）；Evaluator 给轨迹打分；Self-Reflection 根据轨迹、分数和已有记忆写出反思（§3¶1、§3¶4）。分开是为了能逐个替换，例如评估器可以是精确匹配、启发式规则或另一个 LLM（§3¶3）。
2. **短期与长期记忆**：当前轨迹是短期记忆，反思存进长期记忆（§3¶5）；长期记忆最多存 Ω 条，通常 1–3 条，原因是上下文长度有限（§3¶6）。
3. **按尝试循环**：每次尝试后评估、反思、把反思追加进记忆，直到评估器判定正确（§3¶6，Fig. 2）。ALFWorld 上用启发式规则决定何时反思：同一动作得到同一响应超过 3 次，或动作数超过 30（§4.1¶1）。
4. **编程任务的自写测试**：用 CoT 生成测试，用语法树过滤掉无效的，最多取 6 个（§4.3¶2）；用自写测试代替隐藏测试判断对错，所以作者认为结果可以按 pass@1 报告（§4.3¶2）。

## 效果

编程任务用 GPT-4（Tab. 1、Tab. 3），ALFWorld 用 GPT-3 和 ReAct 的同一批示例（§4.1¶2）。[HumanEval](../glossary.md#humaneval)、[MBPP](../glossary.md#mbpp) 指标为 pass@1，[ALFWorld](../glossary.md#alfworld) 为解决的任务数，[HotpotQA](../glossary.md#hotpotqa) 为精确匹配准确率。

| 设置 | 基线 | 结果 | 锚点 |
|---|---|---|---|
| HumanEval Python | 此前 SOTA 65.8（CodeT + GPT-3.5）；GPT-4 单次采样 80.1 | 91.0 | （Tab. 1） |
| HumanEval Rust（最难的 50 题） | GPT-4 60.0 | 68.0 | （Tab. 1） |
| MBPP Python / Rust | GPT-4 80.1 / 70.9 | 77.1 / 75.4 | （Tab. 1） |
| [LeetcodeHardGym](../glossary.md#leetcodehardgym) Python | GPT-4 7.5 | 15.0 | （Tab. 1） |
| 自写测试全过但答案错的比例 | — | HumanEval Python 0.01，MBPP Python 0.16 | （Tab. 2） |
| ALFWorld 134 个环境，ReAct 作 Actor、启发式触发反思 | ReAct 自身重试在第 6–7 次尝试之间停止提升，幻觉率停在 22% | 130 / 134；12 次尝试累计绝对提升 22% | （§4.1¶3、§4.1¶4、§1¶5） |
| HotPotQA 100 题，ReAct 作 Actor | text-davinci-003 0.30；gpt-3.5-turbo 0.26；gpt-4 0.39 | 0.55；0.38；0.51 | （Tab. 5） |
| HotPotQA 100 题，CoT 加标准上下文 | text-davinci-003 0.60；gpt-3.5-turbo 0.57；gpt-4 0.68 | 0.77；0.71；0.80 | （Tab. 5） |
| HotPotQA 消融 | 只附上一条轨迹 | 再加反思高 8 个点 | （§4.2¶4） |
| HumanEval Rust 最难 50 题消融 | 基线 0.60 | 去掉自写测试 0.52；去掉反思 0.60；完整 0.68 | （Tab. 3） |
| starchat-beta，HumanEval Python，8 次平均 | 0.26 | 0.26 | （Tab. 4） |
| WebShop 100 个请求 | ReAct | ReAct + Reflexion 没有明显超过 ReAct | （Fig. 6） |

## 局限与疑点

### 作者承认的

- 依赖 LLM 自我评估的能力或启发式规则，也没有成功的形式保证（§1¶4）。
- 本质是用自然语言做策略优化，仍可能陷入局部最优（§5¶1）；WebShop 这类需要多样探索的任务上没有效果（Fig. 6），作者在附录 B.1 说 4 次尝试后就终止了这组实验。
- 长期记忆只是一个有上限的滑动窗口，作者建议将来换成向量库或 SQL 数据库（§5¶1）。
- 编程任务受限于测试能否写准：测试有误报时会过早提交错误答案（§4.3¶4）；不确定性函数、调用外部 API 的函数等难以用输入输出测试描述（§5¶1）。
- 没有测试时，agent 判断不了当前实现对不对，会做有害的修改（§4.3¶5）。

### 本库判断的

- 91.0 对 80.1 比的是两种预算：GPT-4 的 80.1 是单次生成（Tab. 1），Reflexion 在提交前可以多次生成、跑自写测试、写反思（§4.3¶2）。对隐藏测试只提交一次，符合 pass@1 的定义，但论文没有报告调用次数或 token 成本。
- HotPotQA 上的"提升"是多次尝试后的累计正确率，每次尝试后用标准答案判断对错（§4.2¶2），失败的题一直重试到连续失败 3 次（§4.2¶3）。基线同样可以重试、却解不出任何第一次失败的题（§4.2¶3），所以对比确实隔离了反思的作用；但这个数字不是单次作答的准确率，也不是没有标签时能达到的水平。
- 摘要和引言里的"HotPotQA 提升 20%"（§1¶5、§4¶1）对不上 Tab. 5 的某一行：Tab. 5 的提升在 12 到 25 个点之间，正文没有说 20% 用的是哪一组。
- 作者说反思存进"长期记忆"（§1¶3、§3¶5），实际每个任务只留最近 1–3 条（§3¶6、§4.1¶1），编程任务只留 1 条（§4.3¶2）。反思内容也针对具体题目，例如"应该搜这部剧的主演"（Fig. 7）。论文全文没有跨任务复用反思的实验。
- ALFWorld 用 GPT-3、编程用 GPT-4，各任务的底座模型不同，Tab. 5 也显示同一方法在不同模型上的提升幅度差别很大。
- venue 记为 NeurIPS 2023：NeurIPS 官方论文集（proceedings.neurips.cc，Advances in Neural Information Processing Systems 36，Main Conference Track）收录了这篇论文。论文集列出的作者是 5 人，没有 Edward Berman；本页按 arXiv v4 列 6 人。arXiv v4 的 PDF 页脚仍写着 "Preprint. Under review."。Noah Shinn、Federico Cassano、Edward Berman 署 Northeastern University，Ashwin Gopinath 署 MIT，Karthik Narasimhan 和 Shunyu Yao 署 Princeton。

## 与其他工作的关系

- 与 [ReAct](./202210-react.md)：ALFWorld 和 HotPotQA 上的 Actor 就是 ReAct（§4.1¶1、§4.2¶1），两篇有共同作者 Shunyu Yao 和 Karthik Narasimhan。ReAct 解决一次尝试之内怎样边想边做，Reflexion 在多次尝试之间加一层文字反馈，见[推理与行动交替](../concepts/interleaved-reasoning-acting.md)。
- 与 Self-Refine 等自我修改方法：作者认为 Self-Refine 只适用于单次生成的推理任务，Reflexion 在这类自我评估之上加了一份跨尝试留存的反思记忆（§2¶1）。Self-Refine 本库未收录，比较见[语言反馈强化](../concepts/verbal-reinforcement.md#设计空间)。
- 与 [Generative Agents](./202304-generative-agents.md)：Reflexion 引言把 generative agents 列为 LLM 自主 agent 的例子（§1¶1），但两边的"反思"不是一回事。Generative Agents 的反思按重要性累计周期性触发，写的是对人和事的推断（[Generative Agents](./202304-generative-agents.md) §4.2¶2），Reflexion 的反思在任务失败后触发，写的是下次怎么改（§3¶4），见[记忆流与反思](../concepts/memory-stream-reflection.md#共识与分歧)。
- 与 [ACE](./202510-ace.md)：ACE 把 Reflexion 列为用自然语言反馈改上下文的代表，概括为"反思失败来改进 agent 的规划"（[ACE](./202510-ace.md) §2.1¶1）。ACE 的 Reflector 同样从成败中提炼教训，但写进跨任务复用的 playbook（[ACE](./202510-ace.md) §4.1¶1），这正是本库区分[语言反馈强化](../concepts/verbal-reinforcement.md)和[记忆笔记](../concepts/memory-notes.md)的地方。
- 与 [Voyager](./202305-voyager.md)：Voyager 把 Reflexion 改写成 Minecraft 里的基线，给它执行错误和 Voyager 的自我验证模块（[Voyager](./202305-voyager.md) §3.2¶3）。在没有明确任务、只有"尽量多探索"目标的设置下，Reflexion 几乎没有进展（[Voyager](./202305-voyager.md) §3.3¶2），连木制工具这一级都没解锁（[Voyager](./202305-voyager.md) Tab. 1）。
