---
title: "SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering"
type: paper
summary: 把 LM agent 当作新一类用户，为它设计搜索、看文件和带 linter 的编辑命令，同一模型解决率明显提高
topics: [agent]
aliases: [SWE-agent]
added: 2026-11-27
date: 2024-05-06
url: https://arxiv.org/abs/2405.15793
source_dir: sources/papers/2405.15793
venue: NeurIPS 2024
code: https://swe-agent.com
pages: 118
by:
  - { entity: princeton, role: org }
  - { name: John Yang, role: author }
  - { name: Carlos E. Jimenez, role: author }
  - { name: Alexander Wettig, role: author }
  - { name: Kilian Lieret, role: author }
  - { name: Shunyu Yao, role: author }
  - { name: Karthik Narasimhan, role: author }
  - { name: Ofir Press, role: author }
relations:
  - { concept: agent-computer-interface, rel: proposes, note: 把 LM agent 看作新一类终端用户，提出 agent-computer interface，为它定制搜索、文件查看、带 linter 的编辑和上下文管理，不改模型权重 }
  - { concept: interleaved-reasoning-acting, rel: applies, note: 每一步生成一条 thought 和一条命令，再读入命令执行的反馈，明确沿用 ReAct }
---

## 新认知

- **作者把 LM agent 看作一类新的终端用户，提出 agent-computer interface（ACI）：agent 能用的命令、环境状态怎样反馈给它、历史怎样整理进下一次输入，都按模型的能力和局限来设计（§2¶1、§2¶3），在不改模型权重的前提下提升表现（§1¶5）**；见[面向 agent 的计算机接口](../concepts/agent-computer-interface.md)。
- **同一个 GPT-4 Turbo，只换接口：SWE-bench Lite 上直接用 Linux shell 解决 11.00%，用 SWE-agent 的 ACI 解决 18.00%（Tab. 1）**。本库判断：同样用 ACI 换成 Claude 3 Opus 是 13.00%（Tab. 1），接口带来的差距不比换模型小，见[面向 agent 的计算机接口](../concepts/agent-computer-interface.md#共识与分歧)。
- 照搬给人用的界面可能更差：仿 Vim、VSCode 逐条显示搜索结果的迭代搜索只有 12.0%，比完全不给搜索工具的 15.7% 还低，因为 agent 会把每条结果都翻一遍，耗尽预算或窗口（§5.1¶3），见[面向 agent 的计算机接口](../concepts/agent-computer-interface.md#设计空间)。
- 反馈要短而具体：搜索结果超过 50 条就不显示，改为提示 agent 写更具体的查询（§3¶2）；文件查看器一次显示 100 行，只显示 30 行或整个文件都更差，分别是 14.3% 和 12.7%（§5.1¶4），见[面向 agent 的计算机接口](../concepts/agent-computer-interface.md#设计空间)。
- **护栏能截住一部分级联错误：编辑命令集成 linter，产生语法错误的编辑直接丢弃并让 agent 重试（§3¶5），去掉后从 18.0% 降到 15.0%（Tab. 3）**。编辑仍是难点，51.7% 的轨迹至少有一次失败编辑，一次失败后最终编辑成功的概率从 90.5% 降到 57.2%（§5.2¶4），见[面向 agent 的计算机接口](../concepts/agent-computer-interface.md#开放问题)。
- 上下文按固定规则整理：最近 5 条之前的观察各折叠成一行（§3¶7、Fig. 31）。GPT-4 Turbo 有 128K 窗口（§4¶2），保留完整历史反而从 18.0% 降到 15.0%（Tab. 3），这与[频繁上下文压缩](../concepts/frequent-context-compaction.md#共识与分歧)"长程任务每一步不需要完整历史"的判断一致；在[模型自管理上下文](../concepts/model-managed-context.md#设计空间)那张表里，它属于 harness 定规则的一路。
- 成功的运行结束得早：成功实例的中位成本 $1.21、12 步，失败实例的平均成本 $2.52、21 步；93.0% 的成功实例在预算耗尽前提交，全体只有 69.0%（§5.2¶5）。作者据此认为提高预算上限不太会明显提分（§5.2¶5），见[面向 agent 的计算机接口](../concepts/agent-computer-interface.md#开放问题)。

## 核心问题

LM agent 做编程任务时通常直接用现成的应用，如 Linux shell 或 Python 解释器（§1¶1）。shell 里没有编辑一小段文件的简单命令，编辑出错也没有任何反馈，agent 在这种环境里很难可靠地行动（§1¶2）。本质上这是一个接口设计问题：人机交互研究过界面对人的效率有多大影响（§1¶1），这里被服务的用户换成了 LM；模型固定时，动作、文档和反馈格式本身就是可以优化的变量（§2¶4）。

## 核心洞察

人和 LM 的能力与局限不同。当前的 LM 看不懂图形界面，但 IDE 里的语法检查、导航这类功能用合适的方式呈现给它仍然有用；人可以随手忽略无关信息，对 LM 来说每段内容都有固定的内存和计算代价，干扰内容还会拉低表现（§2¶2）。所以给人设计的界面要按 LM 的特点重新设计。

## 核心设计

1. **四条设计原则**：命令要简单、选项少、文档短；重要操作合并成尽量少的命令；环境反馈信息充分但简洁；用护栏减少错误传播、加快恢复（§2¶5）。
2. **搜索与导航**：`find_file`、`search_file`、`search_dir` 三个命令只返回结果摘要；结果超过 50 条就不显示，提示 agent 改写查询（§3¶2）。
3. **文件查看器**：`open` 打开文件后一次显示最多 100 行，可以 `scroll_up`、`scroll_down`、`goto`；同时显示完整路径、总行数、窗口前后省略的行数，每行带行号（§3¶3）。
4. **编辑器与 linter**：`edit` 按起止行号替换一段内容，编辑后查看器自动显示更新后的文件（§3¶4）；编辑引入 linter 报错时丢弃这次编辑，把错误和前后片段给 agent，让它重试（§3¶5）。
5. **上下文管理**：格式错误的输出会触发错误提示，收到合法输出后只保留第一条错误消息（§3¶6）；最近 5 条之前的观察各折叠成一行，保留计划和动作历史，去掉过时的文件内容（§3¶7）。
6. **循环与设计方法**：每一步生成一条 thought 和一条命令，再读入执行反馈，即 ReAct 式循环（§3¶1）；接口在 dev 集的少量手选样例上靠人工检查定型，窗口大小、历史处理和温度再做网格搜索（§2¶4、§4¶6）。

## 效果

指标为 % Resolved，即打上模型补丁后全部测试通过的实例比例（§4¶5）。消融基于 SWE-agent w/ GPT-4 Turbo（§5.1¶1）。

| 设置 | 基线 | 结果 | 锚点 |
|---|---|---|---|
| [SWE-bench](../glossary.md#swe-bench) 全集，GPT-4 Turbo | 检索增强（RAG）1.31%；此前最好的非交互系统 3.8% | 12.47%，每个解决实例平均 $1.59 | （Tab. 1、§1¶4） |
| SWE-bench 全集，Claude 3 Opus | RAG 3.79% | 10.46% | （Tab. 1） |
| [SWE-bench Lite](../glossary.md#swe-bench-lite)，GPT-4 Turbo | RAG 2.67%；Shell-only 11.00%；Shell-only 不给示例 7.33% | 18.00%，$1.67 | （Tab. 1） |
| [HumanEvalFix](../glossary.md#humanevalfix) pass@1，Python / JS / Java | GPT-4 47.0 / 48.2 / 50.0 | 87.7 / 89.7 / 87.9 | （Tab. 2） |
| Lite 消融：编辑 | 去掉 linter 15.0；没有 `edit` 命令 10.3 | 18.0 | （Tab. 3） |
| Lite 消融：搜索 | 迭代式搜索 12.0；不给搜索命令 15.7 | 摘要式搜索 18.0 | （Tab. 3） |
| Lite 消融：文件查看器窗口 | 30 行 14.3；整个文件 12.7 | 100 行 18.0 | （Tab. 3） |
| Lite 消融：上下文 | 完整历史 15.0；不给示例 16.3 | 只保留最近 5 条观察 18.0 | （Tab. 3） |
| Lite 上 6 次独立运行 | — | 17.33%–18.67%，平均 17.94%；pass@6 32.67% | （Tab. 10） |

## 局限与疑点

### 作者承认的

- 编辑对 agent 仍然困难，失败编辑越积越多，恢复的可能越小（§5.2¶4）。
- 未解决的实例里约一半（52.0%）是实现错误或实现过于特定，级联的失败编辑占 23.4%（§5.2¶6）。
- Llama 3、DeepSeek Coder 等模型在 agent 设置下表现不佳，部分原因是窗口太小，如 Llama 3 只有 8K（§4¶2）。
- 平均表现的方差较低，单个实例能否解决在不同运行之间变化很大（§5¶2、Fig. 4）。
- 附录 A.1 承认编辑护栏有代价：它会强迫某些修改按特定顺序完成。

### 本库判断的

- 引言说 SWE-agent 比只用 Linux shell 的基线多解决 10.7 个百分点（§1¶4），按 Tab. 1 这对应的是不给示例的 Shell-only（7.33%）；与给了示例的 Shell-only（11.00%）比只多 7.0 个点；结果一节的"相对提升 64%"用的是后者（§5¶1）。
- HumanEvalFix 的数字前后不一：§5¶2 写的是 88.3%，Tab. 2 三种语言分别是 87.7、89.7、87.9（Tab. 2）。
- 消融每个设置只报告一次运行（Tab. 3），而完整配置的 6 次运行在 17.33% 到 18.67% 之间浮动（Tab. 10）。"不给示例"降 1.7 个点这类较小的差距，接近运行间的波动。
- 接口和超参数都在少量样本上选定：最终设计来自 dev 集手选样例的定性分析（§4¶6），超参数扫描用的是 dev 集的一个子集（Tab. 5），附录说是 37 个实例。
- 成本口径要注意：$ Avg. Cost 只在成功解决的实例上平均，每个实例预算 $4（§4¶5）。"成功快、失败慢"一段里成功实例用中位数、失败实例用平均数（§5.2¶5），两者不能直接相减。
- 失败归类由 GPT-4o 自动完成，在人工标注的验证集上与作者一致 87%（§5.2¶6）。
- 接口按 GPT-4 Turbo 开发（§1¶4），Claude 3 Opus 的 13.00% 可能低估了它配合专门设计的接口能达到的水平。
- venue 记为 NeurIPS 2024，依据是 PDF 首页脚注；arXiv comment 只写了代码和数据地址。全部作者署 Princeton Language and Intelligence, Princeton University。

## 与其他工作的关系

- 与 [ReAct](./202210-react.md)：SWE-agent 每一步沿用 ReAct 的 thought 加命令（§3¶1），两篇有共同作者 Shunyu Yao 和 Karthik Narasimhan。ReAct 证明了交替推理和行动的价值（[ReAct](./202210-react.md) Tab. 3）；SWE-agent 在同样的循环下比较不同接口，同一个 GPT-4 Turbo 在 Lite 上从 11.00% 到 18.00% 的差距来自接口（Tab. 1），见[推理与行动交替](../concepts/interleaved-reasoning-acting.md#共识与分歧)。
- 与 [Toolformer](./202302-toolformer.md)：Toolformer 把用工具的能力训练进权重（[Toolformer](./202302-toolformer.md) §1¶3），SWE-agent 固定模型、只改工具接口（§2¶4）。两篇分别站在"能力放在哪里"的两端，见[面向 agent 的计算机接口](../concepts/agent-computer-interface.md#共识与分歧)。
- 与 [You don't need long context](./202611-you-dont-need-long-context.md)：NVIDIA 论文的 harness 每轮只发一个 Bash 动作，动作和结果逐条追加进对话（[NVIDIA 论文](./202611-you-dont-need-long-context.md) §2.4），即 SWE-agent 团队的 [mini-swe-agent](../glossary.md#mini-swe-agent) 一类，没有 SWE-agent 的专用命令。两篇都认为不必保留完整历史，做法不同：SWE-agent 每步把旧观察折叠成一行（§3¶7），NVIDIA 让模型写交接摘要后重开对话（[NVIDIA 论文](./202611-you-dont-need-long-context.md) §2.4.1）。见[频繁上下文压缩](../concepts/frequent-context-compaction.md#共识与分歧)。
- 与 [Context Language Models](./202609-context-language-models.md)：SWE-agent 的上下文由 harness 按固定规则整理（§3¶7），CLM 让模型自己改写整个实时上下文（[CLM](./202609-context-language-models.md) §4.1¶2）。两者在[模型自管理上下文](../concepts/model-managed-context.md#设计空间)那张表的两端，之间没有直接对照。
- 与 [InterCode](../glossary.md#intercode)：Shell-only 基线改编自 InterCode（§4¶4）；附录 A.2 说 SWE-agent 的环境也大量沿用 InterCode-Bash 的交互逻辑，SWE-agent 是在同一个环境上加了一层 ACI。
