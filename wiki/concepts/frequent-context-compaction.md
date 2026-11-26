---
title: 频繁上下文压缩
type: concept
summary: 压缩阈值设得远低于 context window，甚至每个动作后压缩一次，让 agent 始终在短上下文里工作
topics: [context]
aliases: [frequent compaction, frequent context compaction, 频繁压缩, EoCC, End-of-Conversation Compaction, SAC, Single-Action Compaction, 单动作压缩]
added: 2026-11-27
status: emerging
relations:
  - { topic: context, rel: part-of }
  - { concept: model-managed-context, rel: alternative-to, note: 两者都不让完整历史一直留在上下文里；频繁压缩由 harness 按阈值决定何时压缩，模型自管理把时机和方式都交给模型 }
---

## 定义

来源：[You don't need long context](../papers/202611-you-dont-need-long-context.md)

把压缩阈值设得远低于模型的 context window（如 16K–48K），上下文一超过阈值就让模型写一份交接摘要，harness 用"原任务 + 摘要"重开对话；极端情形是每个动作后都压缩（§2.4.1）。它要解决的问题是：生成代价随上下文深度增长，256K 窗口下每个生成 token 比 16K 贵 3.6–7 倍（Fig. 1），而长程任务每一步并不需要完整历史（§3.1¶6）。

## 演化

## 设计空间

来源：[You don't need long context](../papers/202611-you-dont-need-long-context.md)

下表按压缩频率排列 NVIDIA 论文比较的几种方式。

| 做法 | 触发 | 上下文里留下什么 | 峰值上下文 | 代价 |
|---|---|---|---|---|
| 全历史累积（FHA） | 不压缩 | 全部动作和观察 | SWE-bench Verified 上最大 173–200K（Tab. 2） | 生成代价随深度上升（Fig. 1） |
| 对话结束式压缩（EoCC） | 上下文超过阈值 | 原任务、进度与计划、相关产物（§2.4.1） | 不超过总上限，本文用 8K–48K（§3） | 有损（§3.1¶2）；FRAMES 上各配置均低于 FHA（Tab. 6） |
| 单动作压缩（SAC） | 每个动作后 | 原任务和语义状态，几乎没有对话历史 | 中位 7–9K token（§5¶2） | 因模型而异：Opus 4.5 持平或高于 FHA，GPT 5.6 Sol 低 2.0–3.3 个点（Tab. 2） |
| 选择性读取 + 压缩兜底 | 长输入不进上下文，按需读取 | 读到的片段 | LOONG 上 16K–48K（论文附录 F） | 依赖检索命中；作者在附录 F 指出 NIAH 的满分得益于词面重合（Tab. 14） |

## 共识与分歧

- NVIDIA 作者认为长程和长输入任务都不需要长上下文，按阈值压缩加选择性读取就能接近或超过完整历史（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §6¶2）。CLM 作者同样不让完整历史一直留在上下文里，但认为按固定规则改写会丢失需要逐字保留的信息（[CLM](../papers/202609-context-language-models.md) §3¶2），所以把编辑权交给模型，见[模型自管理上下文](model-managed-context.md)。
- 频率推到极限的代价因模型而异：EoCC 在长程任务上准确率大体持平（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §3¶4）；推到每个动作一次后，作者报告 Opus 4.5 持平或高于完整历史，GPT 5.6 Sol 低 2.0 和 3.3 个点（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §5¶2），且低于它的全部四档 EoCC（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) Tab. 3、Tab. 5）。
- 更早的 SWE-agent 用另一种固定规则得出方向相同的结果：它把最近 5 条之前的观察各折叠成一行，不写摘要（[SWE-agent](../papers/202405-swe-agent.md) §3¶7）；GPT-4 Turbo 在 SWE-bench Lite 上保留完整历史是 15.0%，折叠后是 18.0%（[SWE-agent](../papers/202405-swe-agent.md) Tab. 3）。作者认为折叠旧观察能留出更多交互轮次，也避免显示过时的文件内容（[SWE-agent](../papers/202405-swe-agent.md) §3¶7）。两篇都由 harness 按规则决定何时丢弃历史；SWE-agent 每一步按位置折叠、不写摘要，NVIDIA 的 EoCC 超过阈值才让模型写摘要，见[面向 agent 的计算机接口](agent-computer-interface.md#设计空间)。
- "更省"取决于计价口径。作者按随窗口大小线性下降的估计价格算，长程任务省 2.2–8.8 倍（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §3¶4）；按现行标价，GPT 5.6 Sol 在 SWE-bench Verified 上压缩后更贵（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) Tab. 3）。CLM 用 prefix-reuse FLOPs 也得出类似提醒：上下文变短不等于成本变低（[CLM](../papers/202609-context-language-models.md) §4.1¶5）。

## 开放问题

来源：[You don't need long context](../papers/202611-you-dont-need-long-context.md)

- 服务方要怎样部署和定价，才能把短窗口的吞吐收益（Fig. 4）交给用户？现行标价下压缩带来的缓存命中下降可能抵消节省（Tab. 3）。
- 压缩鲁棒性随模型差别很大，Qwen 3 Coder Next 在 16K/12K 下的 SWE-bench Verified 几乎全部失败（Tab. 9）。这种能力应由后训练专门获得（§6¶3），还是由 harness 按模型调阈值？
- 历史存档加选择性读取能否补回压缩丢掉的信息（§3.1¶4）？论文只给了论证，没有实验。
- 人在回路、并行工具调用或多 agent 的工作流里，频繁压缩是否仍然成立？主实验只测了每轮一个 Bash 动作的 ReAct 循环（§2.4）。
