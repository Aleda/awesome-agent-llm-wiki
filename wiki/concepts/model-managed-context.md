---
title: 模型自管理上下文
type: concept
summary: 由执行任务的模型自己决定上下文保留、改写和删除什么，取代外部固定规则
topics: [context, memory]
aliases: [model-managed context, model-controlled context, context as a file, 上下文即文件, virtual context management, 虚拟上下文管理]
added: 2026-11-27
status: established
relations:
  - { topic: context, rel: part-of }
  - { topic: memory, rel: part-of }
---

## 定义

让正在执行任务的模型自己决定当前上下文保留什么、改写什么、删掉什么。它要解决的问题是：外部固定规则（到长度阈值就摘要、截断）不知道后续步骤需要哪些细节，在需要逐字保留或局部更新的任务上会丢信息或留下冗余（[CLM](../papers/202609-context-language-models.md) §3¶2）。本库收录的最早来源是 2023-10 的 MemGPT：作者把 context window 当作操作系统的主存，让模型通过函数调用决定把什么放进自己的上下文、把什么换出到外部存储，称为虚拟上下文管理（[MemGPT](../papers/202310-memgpt.md) §1¶5）；2026-09 的 CLM 把模型可编辑的范围从一块固定区域放开到整个实时上下文（[CLM](../papers/202609-context-language-models.md) §4.1¶2）。

## 演化

## 设计空间

来源：[Context Language Models](../papers/202609-context-language-models.md)

"谁决定上下文怎么变"有几条路线。下表的分类和代表工作按 CLM 论文的相关工作整理；频繁压缩一行取自 NVIDIA 的 You don't need long context，固定打分检索和分层记忆两行分别取自 Generative Agents 和 MemGPT，提示词压缩一行取自 LLMLingua，逐条积累的 playbook 一行取自 ACE，按位置折叠旧观察一行取自 SWE-agent，引用逐条带链接。

| 路线 | 谁决定何时改 | 谁决定怎么改 | 代表 | 代价与疑点 |
|---|---|---|---|---|
| harness 固定规则 | harness（长度阈值或每轮） | harness 预设的摘要流程 | Codex、Cursor 的摘要压缩，MEM1（§2¶1） | 不了解任务，摘要会丢失或编造细节（§3¶2） |
| harness 按位置折叠旧观察 | harness，每一步 | 最近 5 条之前的观察各折叠成一行，格式错误的输出只保留第一条错误消息（[SWE-agent](../papers/202405-swe-agent.md) §3¶6、[SWE-agent](../papers/202405-swe-agent.md) §3¶7） | SWE-agent，见[面向 agent 的计算机接口](agent-computer-interface.md#设计空间) | 不写摘要，旧文件内容直接丢弃，要用时 agent 重新打开文件；只在 SWE-bench Lite 上与完整历史比过，18.0 对 15.0（[SWE-agent](../papers/202405-swe-agent.md) Tab. 3） |
| [频繁压缩](frequent-context-compaction.md) | harness，阈值远低于窗口（16K–48K），极端时每个动作后一次（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §2.4.1） | 模型按固定模板写交接简报，按后续执行挑选事实：原任务、进度与计划、相关产物（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §2.4.1） | EoCC、SAC（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) Fig. 3） | 有损（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §3.1¶2）；每次重开对话，缓存命中下降（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) Tab. 3） |
| harness 按固定打分检索外部记忆 | harness 每一步 | 近因、重要性、相关性等权打分，取放得进窗口的前几条（[Generative Agents](../papers/202304-generative-agents.md) §4.1¶7） | Generative Agents | 记忆增长后检索变难（[Generative Agents](../papers/202304-generative-agents.md) §7.2¶1） |
| [提示词压缩](prompt-compression.md)：外部小模型按困惑度删 token | harness，每次调用前 | 对齐过的小模型：先按预算整段删示例，再逐段删困惑度低的 token（[LLMLingua](../papers/202310-llmlingua.md) §4.1¶7、[LLMLingua](../papers/202310-llmlingua.md) §4.2¶3） | LLMLingua | 只删不写，执行任务的模型不参与；小模型太弱时掉点（[LLMLingua](../papers/202310-llmlingua.md) §5.5¶2） |
| 分层记忆：模型在主存和外存之间换入换出 | 系统按 token 阈值发警告、驱逐消息（[MemGPT](../papers/202310-memgpt.md) §2.2¶2）；模型决定何时检索和存储（[MemGPT](../papers/202310-memgpt.md) §2.3¶1） | 模型用函数调用改写一块固定大小的 working context，其余部分只读或由队列管理（[MemGPT](../papers/202310-memgpt.md) §2.1¶1） | MemGPT | 依赖函数调用能力（[MemGPT](../papers/202310-memgpt.md) §3.2.1¶6）；检索常提前停下（[MemGPT](../papers/202310-memgpt.md) §3.2.1¶5） |
| 逐条积累的 playbook：模型写增量条目，确定性逻辑合并 | 系统：每个样本后（[ACE](../papers/202510-ace.md) §4.1¶4） | 模型（Reflector 提炼、Curator 写条目）决定加什么，合并、去重不调用 LLM（[ACE](../papers/202510-ace.md) §3¶3）；只管跨任务的系统提示和记忆，单个任务内的实时上下文不在它的范围内 | ACE，见[记忆笔记](memory-notes.md#设计空间) | 依赖反思模型的能力（[ACE](../papers/202510-ace.md) §5¶2）；只增不删，过时条目靠去重和修剪（[ACE](../papers/202510-ace.md) §3.2¶1） |
| 模型在预定义动作里选 | 模型 | 工具预设：压缩、卸载、检索、分支 | Self-Compact、AutoCompact、ACM、Sculptor（§2¶1） | 动作空间由人设计，自主度受限（§2¶1） |
| 上下文作为外部变量 | 模型决定读入什么 | 实时上下文仍只追加 | RLM（§2¶2） | 不处理实时上下文本身的增长（§2¶2） |
| 上下文即文件，模型任意改写 | 模型 | 模型自己写 Bash 或脚本 | CLM（§4.1¶2） | 中段编辑使前缀缓存失效（§4.1¶5）；依赖模型能力（§5.2¶4）；新的注入面（§6¶1） |

按时间看，模型可编辑的范围在扩大：MemGPT 只开放一块 working context，系统指令只读、消息队列由系统管理（[MemGPT](../papers/202310-memgpt.md) §2.1¶1）；预定义动作一类让模型决定压缩和卸载的时机（§2¶1）；CLM 让模型改写整个实时上下文（§4.1¶2）。何时触发的控制权也在转移：MemGPT 的驱逐仍由系统按阈值执行（[MemGPT](../papers/202310-memgpt.md) §2.2¶2），CLM 由模型自己决定何时编辑上下文文件（§4.1¶2）。ACE 走的是另一个方向：它限制模型怎样改，只许追加和局部更新条目，因为作者观察到让 LLM 整段重写累积的上下文会塌缩（[ACE](../papers/202510-ace.md) §2.2¶2）。MemGPT、CLM 扩大的是模型能改的范围，ACE 收窄的是改法；三者管的对象也不同，MemGPT 和 CLM 管单个任务或会话里的上下文，ACE 管跨任务积累的 playbook。

## 共识与分歧

- 共识：CLM 和 NVIDIA 两篇都不让完整历史一直留在上下文里，实时上下文都压在几十 K 以内。CLM 在 32K 上限下做主实验（[CLM](../papers/202609-context-language-models.md) §5.1.1¶2）；NVIDIA 作者认为长程任务不需要长上下文，压缩阈值收紧到 16K/12K 时准确率仍大体持平（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §3¶4）。
- 分歧在固定规则够不够用。CLM 作者认为人设计的策略在需要逐字保留或局部更新的任务上会丢信息（[CLM](../papers/202609-context-language-models.md) §3¶2），所以把编辑权交给模型，并把这看作 The Bitter Lesson 的又一例（[CLM](../papers/202609-context-language-models.md) §1¶1）。NVIDIA 作者认为按阈值触发的简单压缩在真实 benchmark 上就够了（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §3¶4），压缩丢信息的情形用历史存档加选择性读取补救（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §3.1¶4）。两篇证据的任务不同：CLM 的反例来自合成诊断任务 ContextBench，NVIDIA 用的是 SWE-bench、FRAMES 等真实任务，两篇之间没有直接对照。最接近的一组是 CLM 的 Codex 式摘要基线，它与 EoCC 机制相近，CLM 在 BrowseComp-Plus 上比它高 11.4%（相对值）（[CLM](../papers/202609-context-language-models.md) §5.1.1¶2）。
- MemGPT 与 CLM 方向一致，都把"放什么进上下文"交给模型，区别在范围：MemGPT 把消息历史和文档放在外部存储里，必须显式搬进主存才能被看到（[MemGPT](../papers/202310-memgpt.md) §2¶1）；CLM 在论文附录的相关工作里把 MemGPT 描述为用内存层级连接上下文管理和外部记忆、只允许编辑上下文中一块固定大小的区域，CLM 自己管的是整个实时上下文（[CLM](../papers/202609-context-language-models.md) §4.1¶2）。本库判断：MemGPT 的证据较弱，多会话对话上 GPT-4 加 MemGPT 准确率 92.5%，读递归摘要的 GPT-4 是 32.1%（[MemGPT](../papers/202310-memgpt.md) Tab. 2），但对话短到放得进 GPT-4 Turbo 的窗口，基线却只拿到有损摘要（[MemGPT](../papers/202310-memgpt.md) §3.1.1¶3），没有和完整历史比。
- 整段重写是否安全，CLM 和 ACE 的立场不同。CLM 让模型用 Bash 任意改写实时上下文（[CLM](../papers/202609-context-language-models.md) §4.1¶2）；ACE 作者报告，让 LLM 每一步整段重写累积的上下文，18,282 token 的内容一步被重写成 122 token，准确率跌到低于不做适应（[ACE](../papers/202510-ace.md) §2.2¶2），所以只允许增量更新。两者没有直接对照：ACE 的塌缩发生在跨任务积累的 cheatsheet 上，CLM 观察到的编辑多是原位更新计分板一类的局部修改（[CLM](../papers/202609-context-language-models.md) §4.1¶4）。
- 三篇都提醒能力依赖模型：MemGPT 换成 GPT-3.5 后文档问答明显变差（[MemGPT](../papers/202310-memgpt.md) §3.2.1¶6），CLM 里 Qwen3.5-9B 训练前不如摘要 harness（[CLM](../papers/202609-context-language-models.md) §5.2¶4），NVIDIA 论文里 Qwen 3 Coder Next 在最紧的压缩设置下 SWE-bench Verified 几乎全部失败（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) Tab. 9）。CLM 和 NVIDIA 两篇也都认为上下文管理最终应进入后训练（[CLM](../papers/202609-context-language-models.md) §6¶2、[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §6¶3），NVIDIA 的版本见[语义状态空间模型](semantic-state-space-model.md)。

## 开放问题

来源：[Context Language Models](../papers/202609-context-language-models.md)

- 多大的模型才能可靠地管理自己的上下文？能力不足时是先用 RL 训练（§5.2¶4），还是退回 harness 规则？
- 可编辑上下文让注入或模型自生成的指令可以跨轮次留存（§6¶1），完整性该由谁来校验？
- 模型估不准自己已用的上下文长度（Fig. 30），这一能力应该靠训练获得，还是由环境持续提供计数？MemGPT 选择了后者，持续把 token 限制告诉模型（[MemGPT](../papers/202310-memgpt.md) §2.3¶2）。
- harness 里的管理流程能否蒸馏成模型行为，最终进入权重（§6¶2）？
