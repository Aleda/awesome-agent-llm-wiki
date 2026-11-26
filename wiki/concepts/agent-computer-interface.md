---
title: 面向 agent 的计算机接口
type: concept
summary: 把 LM agent 当作软件的一类新用户，按模型的能力和局限设计它能用的命令、看到的反馈和历史整理方式
topics: [agent]
aliases: [agent-computer interface, ACI, agent-computer interfaces, agent 计算机接口, 智能体-计算机接口]
added: 2026-11-27
status: emerging
relations:
  - { topic: agent, rel: part-of }
---

## 定义

来源：[SWE-agent](../papers/202405-swe-agent.md)

agent-computer interface（ACI）是 LM agent 与计算机之间的抽象层（§1¶2）：它规定 agent 能用哪些命令、环境状态怎样反馈给 agent，并在每一步决定怎样把历史命令和观察与高层指令拼成下一次输入（§2¶3）。设计 ACI 时固定模型，只调整动作、动作的文档和环境反馈，去配合模型的能力和局限（§2¶4）。它要解决的问题是：现有接口是为人或为程序设计的，LM agent 是一类有自己需求和能力的新用户（§2¶1）；直接用 Linux shell 时，agent 缺少编辑一小段文件的简单命令，编辑出错也得不到任何反馈（§1¶2）。

本库收录的最早来源是 2024-05 的 SWE-agent，作者在论文里提出并命名了 ACI（§1¶5）。

## 演化

## 设计空间

来源：[SWE-agent](../papers/202405-swe-agent.md)

下表按 ACI 的组件列出 SWE-agent 比较过的选项，数字是 GPT-4 Turbo 在 SWE-bench Lite 上的解决率，完整配置为 18.0（Tab. 3）。

| 组件 | 更像给人用的选项 | SWE-agent 的选择 | 其他选项 | 依据 |
|---|---|---|---|---|
| 搜索 | 迭代式，逐条显示结果、用 next/prev 翻看：12.0 | 摘要式，最多 50 条，超出就提示改写查询（§3¶2）：18.0 | 不给搜索命令：15.7 | （§5.1¶3、Tab. 3） |
| 编辑 | 没有专用命令，只能用 sed 或重定向覆盖整个文件：10.3 | 按行号替换并自动显示更新结果，集成 linter（§3¶4、§3¶5）：18.0 | 有 `edit` 但不做 lint：15.0 | （§5.1¶4、§5.1¶5、Tab. 3） |
| 文件查看 | 整个文件：12.7 | 一次 100 行，带行号和省略行数（§3¶3）：18.0 | 30 行：14.3 | （§5.1¶4、Tab. 3） |
| 历史 | 完整历史：15.0 | 最近 5 条之前的观察各折叠成一行（§3¶7）：18.0 | — | （Tab. 3） |
| 示例 | — | 给一条示范轨迹：18.0 | 不给：16.3 | （Tab. 3） |

作者从这些比较里总结出四条原则：命令简单、文档短；重要操作合并成尽量少的命令；反馈信息充分但简洁；用护栏减少错误传播（§2¶5）。

历史整理这一项也属于上下文管理。SWE-agent 由 harness 按位置折叠旧观察（§3¶7），在[模型自管理上下文](model-managed-context.md#设计空间)那张表里属于外部固定规则一路；[频繁上下文压缩](frequent-context-compaction.md)让模型写交接摘要后重开对话，是同一问题的另一种固定规则。

## 共识与分歧

- 能力放在接口里还是权重里。SWE-agent 固定模型、只改接口（[SWE-agent](../papers/202405-swe-agent.md) §2¶4），同一个 GPT-4 Turbo 从 Shell-only 的 11.00% 提到 18.00%（[SWE-agent](../papers/202405-swe-agent.md) Tab. 1）；Toolformer 不改工具接口，把调用工具的时机训练进权重（[Toolformer](../papers/202302-toolformer.md) §2¶8）。两篇没有在同一任务上对照，本库把它记为 [Agent](../topics/agent.md#关键争论) 主题"harness 做多少、模型做多少"的一个具体版本。
- harness 整理上下文还是模型自己整理。SWE-agent 的 harness 按固定规则折叠旧观察、只保留第一条错误消息（[SWE-agent](../papers/202405-swe-agent.md) §3¶6、[SWE-agent](../papers/202405-swe-agent.md) §3¶7）；CLM 作者认为人设计的固定策略会在需要逐字保留的任务上丢信息，把编辑权交给模型（[CLM](../papers/202609-context-language-models.md) §3¶2）。两篇没有直接对照，SWE-agent 的规则只在 SWE-bench Lite 上与"保留完整历史"比过（[SWE-agent](../papers/202405-swe-agent.md) Tab. 3）。
- 2026 年的 NVIDIA 论文退回到极简接口：每轮只发一个 Bash 动作，动作和结果逐条追加（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §2.4），没有 SWE-agent 的专用命令。论文没有讨论这个选择，也没有和 SWE-agent 的接口对照；它的模型和 2024 年的 GPT-4 Turbo 不同，专用命令在更强的模型上还有多大价值，本库没有素材回答。

## 开放问题

来源：[SWE-agent](../papers/202405-swe-agent.md)

- 护栏和灵活性怎样取舍？论文附录 A.1 指出 linter 护栏会强迫某些修改按特定顺序完成，是否加护栏要看它减少的错误和它妨碍的工作流哪个更多。
- 失败编辑之后怎样恢复？一次失败后最终编辑成功的概率从 90.5% 降到 57.2%（§5.2¶4），级联的失败编辑占未解决实例的 23.4%（§5.2¶6）。
- 接口能否跨模型迁移？接口按 GPT-4 Turbo 开发（§1¶4），作者认为可以迁移到 Claude 3 Opus（§1¶4），但其他开源模型在 agent 设置下表现不佳（§4¶2）。
- 接口设计能否自动化？SWE-agent 的接口来自人工检查 agent 行为和网格搜索（§2¶4）。作者希望 ACI 研究像人机交互之于心理学那样，反过来帮助理解语言模型（§7¶1）。
