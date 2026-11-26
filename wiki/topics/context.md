---
title: Context
type: topic
summary: agent 每一步能看到什么：上下文的组织、压缩与取舍
aliases: [上下文, context engineering, 上下文工程]
added: 2026-11-26
order: 1
---

## 这个方向在解决什么

agent 的工作信息随步数增长：工具输出、环境观察、中间推理和历史对话不断累积，增长速度超过模型能低成本且可靠处理的范围。context window 即使足够长，注意力计算和 KV cache 的开销也随长度上升；[Lost in the Middle](../papers/202307-lost-in-the-middle.md) 的作者还观察到，相关信息位于长输入中间时模型表现最差（[Lost in the Middle](../papers/202307-lost-in-the-middle.md) §1¶5），见[长上下文位置偏差](../concepts/long-context-position-bias.md)。因此每一步都要决定把哪些信息、以什么形式放进模型的输入。context 方向关心当前这一步的输入；保存在输入之外、按需取回的部分归 memory 方向。

## 概念地图

### 窗口装不下时怎么办

- [提示词压缩](../concepts/prompt-compression.md)：调用前由外部小模型按困惑度删掉冗余 token，目标模型不变（[LLMLingua](../papers/202310-llmlingua.md)）。摘要、裁剪等其他压缩方式本库尚未单独建页。
- [频繁上下文压缩](../concepts/frequent-context-compaction.md)：把压缩阈值设得远低于 context window，甚至每个动作后压缩一次，长输入改为按需读取。
- 检索式上下文：信息放在外部，只把当前需要的部分取回放进输入。

### 谁来决定放什么

- harness 管理的上下文：固定窗口、截断、按规则定期压缩；阈值压得很低的一种见[频繁上下文压缩](../concepts/frequent-context-compaction.md)。
- [模型自管理上下文](../concepts/model-managed-context.md)：模型自己决定读入、写出和丢弃哪些内容。最早的来源是把 context window 当作主存、让模型在主存和外存之间换入换出的 [MemGPT](../papers/202310-memgpt.md)，后来 CLM 把编辑范围放开到整个实时上下文。
- [成功门控的效率奖励](../concepts/success-gated-efficiency-reward.md)：用 RL 训练模型管理上下文时，只在成功轨迹之间奖励更低的推理成本。
- [语义状态空间模型](../concepts/semantic-state-space-model.md)：把单动作压缩后训练进模型，每轮读写一段自然语言状态，代替累积完整历史。

### 长上下文本身

- [长上下文位置偏差](../concepts/long-context-position-bias.md)：相关信息在开头或结尾时表现最好、在中间时最差，扩窗口版本并不更会用上下文（[Lost in the Middle](../papers/202307-lost-in-the-middle.md)）。有效长度与标称长度的差距是同一类问题。
- 推理开销：KV cache 的体积、复用与淘汰；上下文中段被编辑后的缓存复用见[后缀缓存复用](../concepts/suffix-cache-reuse.md)。

### 上下文作为可迭代的对象

- [记忆笔记](../concepts/memory-notes.md)：把系统提示和 agent 记忆当作跨任务逐条积累的 playbook，由模型提炼教训、只做增量更新（[ACE](../papers/202510-ace.md)）。这一页同时属于 memory 和 continual learning 方向；ACE 称之为 context engineering，它与[模型自管理上下文](../concepts/model-managed-context.md#设计空间)的比较见那一页的设计空间表。

## 关键争论

- 长上下文还是频繁压缩：把 context window 做长并保留全部历史，与保持短上下文并频繁压缩，哪条路线在成本和任务完成率上更划算；压缩时丢掉的信息事后能否找回。NVIDIA 作者站在频繁压缩一边，报告把阈值收紧到 16K/12K 时长程任务准确率大体持平（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §3¶4），丢掉的历史靠存档加选择性读取补回（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §3.1¶4）。省钱的前提是服务方按窗口大小部署和定价，按现行标价压缩可能更贵（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) Tab. 3），见[频繁上下文压缩](../concepts/frequent-context-compaction.md#共识与分歧)。
- 模型自管理还是 harness 管理：上下文的取舍交给模型通过训练学会，还是由外部规则决定。前者需要合适的训练信号，后者依赖人工设计，换任务时要重新调。MemGPT 是一种折中：何时腾空间由系统按 token 阈值决定，存什么、取什么由模型决定（[MemGPT](../papers/202310-memgpt.md) §2.2¶2）。CLM 作者认为固定规则会丢掉需要逐字保留的信息（[CLM](../papers/202609-context-language-models.md) §3¶2），NVIDIA 作者认为按阈值压缩在真实 benchmark 上已经够用（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) §3¶4），两篇没有直接对照，见[模型自管理上下文](../concepts/model-managed-context.md#共识与分歧)。
- 标称长度和有效长度：模型声称支持的 context window，与它在多步任务里能稳定利用的长度之间差多少，该用什么任务来测。Lost in the Middle 的作者发现，输入放得进两者窗口时，扩窗口版本与原版的位置曲线几乎重合（[Lost in the Middle](../papers/202307-lost-in-the-middle.md) §2.3¶3），并提出要报告最好和最差位置之间的差距（[Lost in the Middle](../papers/202307-lost-in-the-middle.md) §1¶9）。他们的实验输入只有几千 token（[Lost in the Middle](../papers/202307-lost-in-the-middle.md) Tab. 3），多步 agent 任务上的测量本库还没有素材，见[长上下文位置偏差](../concepts/long-context-position-bias.md#开放问题)。
- 上下文该压短还是积累得更全：LLMLingua 作者把提示词压缩 20 倍，GSM8K 上只掉 1.5 个点（[LLMLingua](../papers/202310-llmlingua.md) Tab. 2）；ACE 作者认为模型能自己从长而详尽的上下文里挑出相关部分，主张跨任务的 playbook 只增不压（[ACE](../papers/202510-ace.md) §1¶4），并报告让 LLM 整段重写累积的上下文会塌缩（[ACE](../papers/202510-ace.md) §2.2¶2）。两者压缩的对象不同，前者是单次调用的 few-shot 示例，后者是跨任务的策略；位置偏差的结果（[Lost in the Middle](../papers/202307-lost-in-the-middle.md) §1¶5）则提醒，内容在上下文里不等于模型用得上，见[提示词压缩](../concepts/prompt-compression.md#共识与分歧)。

## 最近进展
