---
title: "Lost in the Middle: How Language Models Use Long Contexts"
type: paper
summary: 相关信息放在长输入中间时模型表现最差，呈 U 形曲线；扩了窗口的版本并不更会用上下文
topics: [context]
aliases: [Lost in the Middle]
added: 2026-11-27
date: 2023-07-06
url: https://arxiv.org/abs/2307.03172
source_dir: sources/papers/2307.03172
venue: TACL 2024
code: https://nelsonliu.me/papers/lost-in-the-middle
pages: 18
by:
  - { entity: stanford, role: org }
  - { entity: uc-berkeley, role: org }
  - { name: Samaya AI, role: org }
  - { name: Nelson F. Liu, role: author }
  - { name: Kevin Lin, role: author }
  - { name: John Hewitt, role: author }
  - { name: Ashwin Paranjape, role: author }
  - { name: Michele Bevilacqua, role: author }
  - { name: Fabio Petroni, role: author }
  - { name: Percy Liang, role: author }
relations:
  - { concept: long-context-position-bias, rel: proposes, note: 在多文档问答和键值检索里只移动相关信息的位置，发现表现呈 U 形，开头和结尾最好、中间最差，扩窗口版本与原版曲线几乎重合 }
---

## 新认知

- **模型能否用上长输入里的信息取决于它在哪：相关信息在开头或结尾时表现最好，在中间时明显变差，形成 U 形曲线（§1¶5、Fig. 5）**；本库把这一现象记为[长上下文位置偏差](../concepts/long-context-position-bias.md)。
- **中间位置的损失大到能抵消给文档的收益：20 篇和 30 篇文档设置下，答案放在中间时 GPT-3.5-Turbo 的准确率低于不给任何文档的闭卷设置（56.1%）（§2.3¶2）**，见[长上下文位置偏差](../concepts/long-context-position-bias.md#共识与分歧)。
- 标称窗口更长不等于更会用上下文：输入同时放得进两个模型的窗口时，扩窗口版本与原版的曲线几乎重合（§2.3¶3），可见[长上下文位置偏差](../concepts/long-context-position-bias.md)不是窗口长度能解决的。
- 偏差在只需逐字匹配的检索上也存在：在随机 UUID 组成的键值检索里，Claude-1.3 接近满分，GPT-3.5-Turbo 和 MPT-30B-Instruct 在键值对位于中间时最差（§3.2¶2、§3.2¶3），说明[长上下文位置偏差](../concepts/long-context-position-bias.md)不只来自语义理解。
- 把问题同时放在数据前后，键值检索几乎全部做对，多文档问答的趋势却基本不变（§4.2¶2、§4.2¶3）；作者在[长上下文位置偏差](../concepts/long-context-position-bias.md#设计空间)上试的提示层补救只对简单检索有效。
- U 形不全是指令微调造成的：未经指令微调的 MPT-30B 同样呈 U 形（§4.3¶2）；Llama-2 只有 13B 和 70B 出现 U 形，7B 只偏向末尾（§4.3¶4），[长上下文位置偏差](../concepts/long-context-position-bias.md)的形状随规模变化。
- **检索文档给多了收益很快饱和：开放域问答里超过 20 篇后准确率只微涨（§5¶3），作者建议重排或截断检索结果，把相关信息挪到输入开头（§5¶3）**；这把[长上下文位置偏差](../concepts/long-context-position-bias.md#设计空间)变成了"往输入里放什么、放在哪"的工程问题。
- 作者提出一条新的评测要求：声称模型能稳健使用长上下文，就要证明它在最好和最差位置之间的差距很小（§1¶9），对应[长上下文位置偏差](../concepts/long-context-position-bias.md#开放问题)的测法。

## 核心问题

硬件和算法的进步让 context window 从 512–2048 token 扩到 4K、32K 乃至 100K，但模型在下游任务里怎样使用这些输入并不清楚（§1¶2）。平均准确率看不出模型是否在每个位置都能取到信息。本质上这是一个测量问题：标称的窗口长度和模型能可靠使用的长度可能不同，要用控制变量的实验把两者分开（§1¶3）。

## 核心洞察

如果模型能稳健使用长输入，它的表现就不该随相关信息的位置变化（§1¶3）。所以只需固定任务内容，单独改变相关信息的位置和输入的总长度，就能测出模型对上下文的利用是否均匀。

## 核心设计

1. **多文档问答**：取 [NaturalQuestions-Open](../glossary.md#naturalquestions-open) 中长答案是段落的 2655 个问题（§2.1¶2），每题给 1 篇含答案的 Wikipedia 段落和 k−1 篇检索来的干扰段落，干扰段落按相关度降序排列（§2.1¶3）。移动含答案段落的位置来改变位置，增减干扰段落来改变长度（§2.1¶4），k 取 10、20、30（§2.3¶1）。这一设置模仿检索增强生成（§1¶4）。
2. **闭卷与 oracle 参照**：闭卷不给任何文档，oracle 只给含答案的那一篇，用来给位置曲线定上下界（§2.3¶1、Tab. 1）。
3. **合成键值检索**：输入是一组随机 UUID 组成的 JSON 键值对，要求返回指定键的值，用随机 UUID 尽量去掉语言语义的干扰（§3.1¶2）；键值对数取 75、140、300，各 500 例（§3.2¶1）。
4. **三项归因实验**：比较 decoder-only 与 encoder-decoder 架构（§4.1）、把问题放在数据前后的 query-aware contextualization（§4.2）、指令微调前后的同一模型（§4.3）。作者称之为初步探究（§4¶1）。
5. **开放域问答案例**：用标准的检索器加阅读器流程，改变检索文档数 k，同时看检索召回和阅读器准确率（§5¶2、Fig. 11）。

## 效果

| 设置 | 基线 | 结果 | 锚点 |
|---|---|---|---|
| 多文档问答，20 篇文档，GPT-3.5-Turbo | 闭卷 56.1%，oracle 88.3%（Tab. 1） | 答案在第 1、10、20 位：75.8%、53.8%、63.2% | （Tab. 6） |
| 同上，30 篇文档，GPT-3.5-Turbo (16K) | 闭卷 56.0%（Tab. 1） | 第 1、10、30 位：73.4%、50.5%、63.7% | （Tab. 7） |
| 同上，20 篇文档，Claude-1.3 | 闭卷 48.3%（Tab. 1） | 第 1、10、20 位：59.9%、56.8%、60.1% | （Tab. 6） |
| 扩窗口对照，10 篇文档 | GPT-3.5-Turbo：76.8%、61.2%、62.4%（第 1、5、10 位） | GPT-3.5-Turbo (16K)：76.9%、61.0%、62.5% | （Tab. 5） |
| 键值检索加 query-aware contextualization | 不加时最差 45.6%（§4.2¶3） | 75、140、300 对上所有模型接近满分 | （§4.2¶2） |
| Flan-UL2，输入在 2048 token 训练窗口内 | — | 最好与最差位置相差 1.9 个点 | （§4.1¶3） |
| MPT-30B 指令微调前后 | 基座最好与最差相差近 10% | 指令微调后约 4% | （§4.3¶2） |
| 开放域问答，检索文档超过 20 篇 | 20 篇 | GPT-3.5-Turbo 约 +1.5%，Claude-1.3 约 +1% | （§5¶3） |

## 局限与疑点

### 作者承认的

- GPT-4 只在 500 题的子集上测了 20 篇文档设置，作者估计全量实验要花 6000 美元以上（§2.2¶3）。附录中 GPT-4 同样呈 U 形（Fig. 15）。
- NaturalQuestions-Open 有歧义，少数干扰段落可能也含合理答案（§2.1¶3）；作者在无歧义子集上复验，结论相同（Fig. 12）。
- 架构、指令微调两部分的解释是假设：encoder-decoder 更稳健可能因为双向编码器能在后文的上下文里处理每篇文档（§4.1¶3）；未经指令微调的模型会用长上下文，可能是从预训练语料里格式相近的文本学到的（§4.3¶3）。

### 本库判断的

- "长上下文"其实不长：30 篇文档的输入对 GPT-3.5-Turbo 平均约 4.4K token，最长 6,101；300 对键值约 15K token（Tab. 3、Tab. 4）。U 形在几千 token 的输入里就已出现，所以它描述的是模型怎样使用输入，与窗口是否吃紧无关。
- §2.3¶2 说 GPT-3.5-Turbo 在 20 篇和 30 篇文档设置下都低于闭卷的 56.1%；但 30 篇文档的输入超出 4K 窗口，表里只有 GPT-3.5-Turbo (16K) 的数字，它的闭卷是 56.0%（Tab. 7、Tab. 1）。结论不变，表述不够精确。
- 准确率按"输出里是否出现任一标准答案"判定（§2.1¶5），偏向输出较长的模型；不同模型的绝对值不宜直接比较，位置曲线的形状更可靠。
- 任务都是"一个相关片段 + 一堆干扰"的抽取式问答。agent 轨迹里的信息往往分散在多处、要综合使用，这种场景下位置偏差有多大，论文没有测。
- 实验模型都是 2023 年的 GPT-3.5-Turbo、Claude-1.3、MPT-30B-Instruct 和 LongChat-13B（§2.2¶2、§2.2¶3），后来专门针对长上下文训练的模型是否仍呈 U 形，需要新的素材来回答。
- arXiv comment 写的是"Accepted for publication in TACL, 2023"；本库收录的 [NVIDIA 论文](./202611-you-dont-need-long-context.md)在参考文献里把它引为 TACL 第 12 卷（2024 年），venue 按刊出卷期记为 TACL 2024。

## 与其他工作的关系

- 与 [MemGPT](./202310-memgpt.md)：MemGPT 引用本文，作为"长上下文模型用不好多出来的上下文"的证据（[MemGPT](./202310-memgpt.md) §1¶2），据此不再扩窗口，改在固定窗口上做内存层级。
- 与 [ACE](./202510-ace.md)：ACE 作者认为 LLM 与人不同，给长而详尽的上下文更有效，模型能自己挑出相关部分（[ACE](./202510-ace.md) §1¶4）。这与本文"中间的信息常被忽略"的结论方向相反；ACE 没有引用本文，也没有测条目在 playbook 中的位置对效果的影响。本库把这一分歧记在[长上下文位置偏差](../concepts/long-context-position-bias.md#共识与分歧)。
- 与 [LLMLingua](./202310-llmlingua.md)：LLMLingua 让输入变短，但保留原有顺序，不处理位置。本文的建议是重排检索结果、把相关内容放到开头（§5¶3），两者可以组合。
- 与心理学的系列位置效应：作者指出人类自由回忆列表时也最记得首尾项；在 Transformer 上看到类似现象令人意外，因为自注意力在机制上能同等地取到任何位置的 token（§6.3¶1）。
