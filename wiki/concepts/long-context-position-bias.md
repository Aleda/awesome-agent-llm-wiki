---
title: 长上下文位置偏差
type: concept
summary: 模型用长输入里的信息时，开头和结尾处最好、中间最差，准确率随位置呈 U 形
topics: [context]
aliases: [lost-in-the-middle effect, lost in the middle effect, 中间迷失, U-shaped performance curve, U 形位置曲线]
added: 2026-11-27
status: emerging
relations:
  - { topic: context, rel: part-of }
---

## 定义

来源：[Lost in the Middle](../papers/202307-lost-in-the-middle.md)

同一份输入里，相关信息的位置会改变模型能否用上它：相关信息在开头（primacy bias）或结尾（recency bias）时表现最好，在中间时明显变差，准确率随位置呈 U 形（§1¶5）。它要回答的问题是：context window 的标称长度能否代表模型可靠使用的长度。如果模型能稳健使用长输入，表现应当几乎不随位置变化（§1¶3）；作者据此提出，声称模型能用长上下文时要报告最好和最差位置之间的差距（§1¶9）。

## 演化

## 设计空间

来源：[Lost in the Middle](../papers/202307-lost-in-the-middle.md)

下表列出原论文试过或建议的缓解办法，以及它们在多文档问答上的效果。

| 做法 | 改了什么 | 效果 | 锚点 |
|---|---|---|---|
| 扩 context window | 换成同系列的扩窗口版本 | 输入放得进两者窗口时，曲线几乎重合 | （§2.3¶3） |
| encoder-decoder 架构 | 双向编码器处理输入 | 在训练窗口内较稳健，Flan-UL2 最好和最差位置只差 1.9 个点；超出训练长度后同样中间变差 | （§4.1¶3） |
| query-aware contextualization | 问题同时放在数据前后 | 键值检索接近满分（§4.2¶2）；多文档问答的趋势基本不变（§4.2¶3） | （§4.2¶2、§4.2¶3） |
| 指令微调 | 同一模型微调前后对比 | 基座也呈 U 形；最好与最差的差距从近 10% 降到约 4% | （§4.3¶2） |
| 重排或截断检索结果 | 把相关内容挪到开头，或少取几篇 | 作者的建议，未做实验 | （§5¶3） |

缩短输入是另一条路，见[频繁上下文压缩](frequent-context-compaction.md)和[提示词压缩](prompt-compression.md)。这两页的素材都没有测位置的影响；本库判断，输入变短后中间位置变少，但 Lost in the Middle 在 10 篇文档、约 1.5K token 的输入上已经看到中间变差（[Lost in the Middle](../papers/202307-lost-in-the-middle.md) Tab. 3、[Lost in the Middle](../papers/202307-lost-in-the-middle.md) Tab. 5），所以短输入不能直接排除这个问题。

## 共识与分歧

- MemGPT 引用 Lost in the Middle，作为长上下文模型用不好多出来的上下文的证据（[MemGPT](../papers/202310-memgpt.md) §1¶2），并据此选择在固定窗口上做内存层级，见[模型自管理上下文](model-managed-context.md)。
- ACE 作者的看法方向相反：他们认为 LLM 与人不同，给长而详尽的上下文更有效，模型能自己挑出相关部分（[ACE](../papers/202510-ace.md) §1¶4），所以让 playbook 不断变长。ACE 没有引用 Lost in the Middle，也没有测条目在 playbook 里的位置是否影响效果。两篇的任务不同：Lost in the Middle 每题只有一个相关片段，ACE 的 playbook 里有很多条可能同时有用的策略。
- 本库判断：ACE 自己的数据也没有证明越长越好。FiNER 上把 playbook 的修剪上限从 100K 降到 10K token，准确率是 78.3 和 78.6（[ACE](../papers/202510-ace.md) Tab. 21）。
- 截至 2026-11，本库只有 Lost in the Middle 一份素材直接测量位置偏差，实验模型是 2023 年的 GPT-3.5-Turbo、Claude-1.3、MPT-30B-Instruct 和 LongChat-13B（[Lost in the Middle](../papers/202307-lost-in-the-middle.md) §2.2¶2、[Lost in the Middle](../papers/202307-lost-in-the-middle.md) §2.2¶3）。

## 开放问题

- 后来专门做长上下文训练的模型是否还呈 U 形？需要有新模型数据的素材。
- agent 轨迹里的信息分散在多处、要综合使用，位置偏差在这种场景下有多大？原论文只测了单个相关片段的抽取式问答（[Lost in the Middle](../papers/202307-lost-in-the-middle.md) §2.1¶1）。
- 作者推测 U 形与指令微调数据把任务说明放在开头有关（[Lost in the Middle](../papers/202307-lost-in-the-middle.md) §4.3¶1），但基座模型同样呈 U 形（[Lost in the Middle](../papers/202307-lost-in-the-middle.md) §4.3¶2）。U 形从何而来？
- 自注意力在机制上能同等地取到任何位置（[Lost in the Middle](../papers/202307-lost-in-the-middle.md) §6.3¶1），这一偏差该靠训练消除，还是由 harness 按位置安排输入？
