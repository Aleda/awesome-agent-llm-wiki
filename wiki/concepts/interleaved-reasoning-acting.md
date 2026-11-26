---
title: 推理与行动交替
type: concept
summary: agent 在同一条轨迹里交替写自然语言推理和执行环境动作，推理指导下一步动作，动作结果再供推理使用
topics: [agent]
aliases: [interleaved reasoning and acting, reasoning and acting, ReAct loop, ReAct 循环, ReAct-style agent loop, thought-action-observation loop, 思考-行动-观察循环]
added: 2026-11-27
status: established
relations:
  - { topic: agent, rel: part-of }
  - { concept: self-supervised-tool-learning, rel: alternative-to, note: 两者都让模型自己决定何时调用外部工具；推理与行动交替靠少量示例提示冻结的模型、可多步交互，自监督工具使用学习把单步调用训练进权重 }
---

## 定义

让 LLM agent 在同一条轨迹里交替生成两类输出：自然语言的推理（thought）和作用于环境的动作。thought 不改变环境、不产生观察，只把对当前上下文的推理写回上下文，供后面的推理和行动使用（[ReAct](../papers/202210-react.md) §2¶2）。它要解决的问题是：只推理的 chain-of-thought 不接触外部世界，会幻觉事实、传播错误；只行动的 agent 不对高层目标做抽象推理，也不维护支撑行动的工作记忆（[ReAct](../papers/202210-react.md) §1¶2）。

本库收录的最早来源是 2022-10 的 ReAct。ReAct 承认 Inner Monologue 更早做出了闭环系统，并说自己建立在它之上（[ReAct](../papers/202210-react.md) §5¶3）；ReAct 认为 Inner Monologue 的"独白"只限于环境状态和还要完成什么，算不上真正的推理（[ReAct](../papers/202210-react.md) §4¶6）。按这一区分，本库把 ReAct 记为提出者，Inner Monologue 未收录。

## 演化

## 设计空间

下表按"推理和行动怎样组合"排列。前三行取自 ReAct 论文的基线和相关工作；Inner Monologue、WebGPT、SayCan 本库没有收录原文。

| 做法 | 推理 | 行动 | 代表 | 代价与疑点 |
|---|---|---|---|---|
| 只推理 | 有，基于模型内部知识 | 无 | CoT、CoT-SC（[ReAct](../papers/202210-react.md) §3.2¶2） | 幻觉是 CoT 失败的主因，占 56%（[ReAct](../papers/202210-react.md) Tab. 2） |
| 只行动 | 无 | 有 | Act，近似 WebGPT 的交互方式（[ReAct](../papers/202210-react.md) §3.2¶2）；SayCan（[ReAct](../papers/202210-react.md) §5¶3） | 不会把目标分解成子目标，会丢失环境的当前状态（[ReAct](../papers/202210-react.md) §4¶4） |
| 只复述环境反馈的独白 | 限于当前目标和子目标 | 有 | Inner Monologue；ReAct 论文的 ReAct-IM 消融（[ReAct](../papers/202210-react.md) §4¶7） | ALFWorld 上 53%，ReAct 71%（[ReAct](../papers/202210-react.md) §4¶7） |
| 推理与行动交替 | 自由形式，知识任务每步都有，决策任务由模型决定何时插入（[ReAct](../papers/202210-react.md) §2¶3） | 有 | ReAct | 结构约束降低推理灵活性，可能反复生成同样的 thought 和 action（[ReAct](../papers/202210-react.md) §3.3¶4） |
| 交替与只推理互为退路 | 两者都有，按启发式切换 | 有 | ReAct → CoT-SC、CoT-SC → ReAct（[ReAct](../papers/202210-react.md) §3.2¶3） | HotpotQA 35.1、FEVER 64.6，仍远低于监督学习 SoTA（[ReAct](../papers/202210-react.md) Tab. 1） |
| 交替 + 专门设计的命令和反馈 | 每步一条 thought | 一条命令 | SWE-agent（[SWE-agent](../papers/202405-swe-agent.md) §3¶1） | 收益来自接口，见[面向 agent 的计算机接口](agent-computer-interface.md) |
| 极简交替循环 | 由模型决定 | 每轮一个 Bash 动作 | You don't need long context 的 harness（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §2.4） | 动作和结果逐条追加，历史会一直增长，需要另外压缩，见[频繁上下文压缩](frequent-context-compaction.md) |

把工具调用训练进权重的[自监督工具使用学习](self-supervised-tool-learning.md)是另一条路线：Toolformer 每个输入最多调用一次 API（[Toolformer](../papers/202302-toolformer.md) §4.2¶2），没有多步的推理和观察。

## 共识与分歧

- 交替在长程决策任务上收益最明显，在知识问答上不一定。ReAct 在 ALFWorld 和 WebShop 上明显超过只行动的 Act（[ReAct](../papers/202210-react.md) Tab. 3、[ReAct](../papers/202210-react.md) Tab. 4）；HotpotQA 上单用 ReAct 是 27.4，低于 CoT 的 29.4（[ReAct](../papers/202210-react.md) Tab. 1）。作者把这归因于事实性和灵活性的取舍，所以提出与 CoT-SC 组合（[ReAct](../papers/202210-react.md) §3.3¶5）。
- 循环本身不决定上限。SWE-agent 和它的 Shell-only 基线用的都是同一种 thought 加命令的循环，同一个 GPT-4 Turbo 在 SWE-bench Lite 上的解决率是 18.00% 和 11.00%（[SWE-agent](../papers/202405-swe-agent.md) Tab. 1），差别来自 agent 能用的命令和看到的反馈。
- 提示还是训练：ReAct 的主实验只用少量示例提示（[ReAct](../papers/202210-react.md) §2¶3），但作者也报告 8B/62B 模型靠提示学不会交替，用 3,000 条轨迹微调后变成四种方法里最好的（[ReAct](../papers/202210-react.md) §3.3¶8）。Toolformer 作者认为基于 few-shot 提示的工具使用只适用于事先知道要用哪个工具的特定任务（[Toolformer](../papers/202302-toolformer.md) §6¶2）。
- 到 2026 年，交替循环已经是 agent 论文的默认 harness：NVIDIA 论文的两种 harness 都是极简 ReAct 循环（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §2.4），ACE 在 AppWorld 上以 ReAct 为基线报告提升（[ACE](../papers/202510-ace.md) §4.3¶2）。

## 开放问题

- 怎样跳出重复生成同样 thought 和 action 的循环？ReAct 作者猜测与贪心解码有关，更好的解码可能有帮助（[ReAct](../papers/202210-react.md) §3.3¶4）。
- 动作空间大的任务需要更多示例，很容易超出上下文学习的输入长度（[ReAct](../papers/202210-react.md) §6¶1）。示例和越来越长的轨迹怎样同时放进窗口，是 [Context](../topics/context.md) 方向的问题。
- 搜索没返回有用信息时，模型很难恢复和改写思路（[ReAct](../papers/202210-react.md) §3.3¶5）。错误恢复靠模型自己，还是靠环境给出更好的反馈？SWE-agent 选了后者（[SWE-agent](../papers/202405-swe-agent.md) §2¶5）。
- 能作用于外部环境的动作空间带来安全风险，ReAct 作者在论文的 Ethics Statement 里提醒过这一点，实验只用了没有危险动作的环境。thought 让人能检查和编辑 agent 的决策（[ReAct](../papers/202210-react.md) §2¶4），这能否当作一种约束手段？
