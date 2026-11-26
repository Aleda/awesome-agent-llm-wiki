---
title: "LLMLingua: Compressing Prompts for Accelerated Inference of Large Language Models"
type: paper
summary: 用小模型的困惑度由粗到细删减提示词，GSM8K 上压缩 20 倍只掉 1.5 个点，适用于黑盒 API
topics: [context]
aliases: [LLMLingua]
added: 2026-11-27
date: 2023-10-09
url: https://arxiv.org/abs/2310.05736
source_dir: sources/papers/2310.05736
venue: EMNLP 2023
code: https://aka.ms/LLMLingua
pages: 19
by:
  - { entity: microsoft, role: org }
  - { name: Huiqiang Jiang, role: author }
  - { name: Qianhui Wu, role: author }
  - { name: Chin-Yew Lin, role: author }
  - { name: Yuqing Yang, role: author }
  - { name: Lili Qiu, role: author }
relations:
  - { concept: prompt-compression, rel: extends, note: 在 Selective-Context 的小模型删减上加了预算控制、迭代式 token 压缩和分布对齐 }
---

## 新认知

- **LLMLingua 在 Selective-Context 用小模型删掉低信息量内容的做法上，加了预算控制、迭代式 token 压缩和分布对齐（§1¶3、§2.1¶4），删减仍在 LLM 之外完成，压缩后的提示词能直接交给只能通过 API 访问的模型（§1¶1）**；见[提示词压缩](../concepts/prompt-compression.md)。
- 提示词各部分的冗余度不同：指令和问题直接决定输出，多个示例之间信息重复（§4.1¶2），所以[提示词压缩](../concepts/prompt-compression.md#设计空间)要按部分分配预算，示例压得最狠。
- 压缩率高时逐 token 删会把提示词删得支离破碎，作者先整段丢示例、再删 token（§4.1¶3）；消融里去掉预算控制，GSM8K 从 79.08 降到 73.62（Tab. 3），见[提示词压缩](../concepts/prompt-compression.md)。
- 逐 token 按困惑度删有独立性假设的问题，作者把前一段压缩后的结果接到后一段之前再算困惑度（§4.2¶3）；去掉这一步 GSM8K 降到 72.93（Tab. 3），是消融里掉得最多的一项，见[提示词压缩](../concepts/prompt-compression.md)。
- **GSM8K 上压缩 20 倍，GPT-3.5-Turbo 的 EM 从完整提示词的 78.85 降到 77.33（Tab. 2）；同一设置下让 GPT-4 改写压缩只有 56.33（Tab. 2），作者认为生成式压缩会漏掉推理步骤（§5.3¶2）**，这是[提示词压缩](../concepts/prompt-compression.md#共识与分歧)相对摘要式压缩的主要论据。
- 压缩后的提示词人很难读懂，但 GPT-4 能从中恢复出完整推理过程，GPT-3.5-Turbo 不行（§5.5¶8）；被压缩的提示词能否被理解取决于目标模型，见[提示词压缩](../concepts/prompt-compression.md#开放问题)。
- 节省不只在输入一侧：压缩率越高，目标模型生成的文本越短（§5.5¶4）；作者估计 5 倍压缩时总计算量约省 4 倍（§5.5¶6），见[提示词压缩](../concepts/prompt-compression.md)。

## 核心问题

思维链、上下文学习和检索让提示词越来越长（§1¶1）。量化、剪枝这类方法要改模型参数，模型只能通过 API 访问时用不上（§1¶1）。前作 Selective-Context 用小模型算自信息删掉信息量低的内容，但它忽略了被删内容之间的依赖，也没有处理小模型与目标 LLM 的分布差异（§1¶3）。本质上这是一个在 token 预算下保留目标模型所需信息的选择问题：在不碰目标模型的前提下，让压缩前后目标模型的输出分布尽量接近（§3¶1）。

## 核心洞察

自然语言本身有冗余，可以压缩（§1¶2）；困惑度低的 token 对整体熵贡献小，删掉对 LLM 理解上下文影响不大（§1¶3）。所以一个便宜的小模型的困惑度就能近似"目标模型需要哪些 token"，只要小模型的分布与目标模型足够接近。

## 核心设计

1. **预算控制器**：给指令、示例和问题分配不同的压缩率，指令和问题保留得多（实验里 τ_ins=0.85、τ_que=0.9），示例压得多（§4.1¶2、§5.1¶3）；示例按困惑度从高到低整段选入，直到超出预算（§4.1¶7）。高压缩率时整段丢弃能保住语言的完整性（§4.1¶3）。
2. **迭代式 token 级压缩（ITPC）**：把整段提示词切成若干段（实验里每段 100 token），逐段用小模型算条件困惑度，前一段压缩后的结果接在后一段之前，保留困惑度高于阈值的 token（§4.2¶3、§4.2¶5、§5.1¶3）。这样做是为了缓解逐 token 独立删除的误差（§4.2¶2）。
3. **分布对齐**：用目标 LLM 生成的数据对小模型做指令微调，缩小两者分布的差距（§4.3¶1）；实验里用 Alpaca 数据对齐 Alpaca-7B 或 GPT2-Alpaca（§5.1¶3）。
4. **只改输入**：整个过程不需要目标模型的梯度和中间结果，压缩后的提示词直接交给 GPT-3.5-Turbo 或 Claude-v1.3（§1¶2、§5.1¶3）。

## 效果

| 设置 | 基线 | 结果 | 锚点 |
|---|---|---|---|
| [GSM8K](../glossary.md#gsm8k)，GPT-3.5-Turbo，1-shot 约束 | 完整提示词 78.85（2,366 token）；只留 1 个示例 77.10（6x）；[Selective-Context](../glossary.md#selective-context) 53.98（5x） | 79.08（446 token，5x） | （Tab. 2） |
| GSM8K，quarter-shot 约束 | Selective-Context 44.20（15x）；GPT-4 改写 56.33（20x） | 77.33（117 token，20x） | （Tab. 2） |
| [BBH](../glossary.md#bbh)，1-shot / half-shot / quarter-shot | 完整提示词 70.07（774 token） | 70.11（3x）/ 61.60（5x）/ 56.85（7x） | （Tab. 2） |
| ShareGPT 对话，3x 约束，BERTScore F1 | Selective-Context 87.12（3.3x） | 87.70（3.3x） | （Tab. 1） |
| Arxiv-March23 摘要，175 token 约束，BERTScore F1 | Selective-Context 88.16（8x） | 89.03（9x） | （Tab. 1） |
| GSM8K，目标模型换成 Claude-v1.3 | 简单提示词 81.8（691 token，3x） | 83.51（5x）、82.61（14x） | （Tab. 4） |
| GSM8K 消融，1-shot 约束 | 完整方法 79.08 | 去掉迭代压缩 72.93；去掉预算控制 73.62；去掉分布对齐 78.62 | （Tab. 3） |
| 端到端延迟，GSM8K，V100-32G | 不压缩 8.6 秒 | 5x 压缩 2.3 秒（其中压缩 0.3 秒）；10x 压缩 1.3 秒 | （Tab. 6） |

## 局限与疑点

### 作者承认的

- 压缩率推到 25–30 倍时 GSM8K 会明显掉点，各方法都一样，LLMLingua 掉点出现得更晚（Fig. 3）。
- 小模型和目标 LLM 的分词器有差异，可能低估提示词的真实长度（论文 Limitations 一节）。
- 小模型太弱时效果下降：换成 GPT2-Alpaca，三档压缩率下分别比 Alpaca-7B 低 2.06、0.99、1.06 个点，作者归因于分布差异，对齐也补不全（§5.5¶2）。

### 本库判断的

- 示例本身高度冗余，收益有一部分来自这里。GSM8K 上直接只保留 1 个示例就有 77.10（6x），LLMLingua 在 5x 下是 79.08（Tab. 2），两者只差约 2 个点。与完整提示词比显得几乎无损，与"少给几个示例"这个更简单的基线比，提升要小得多。
- 示例的取舍按示例自身的困惑度排序（§4.1¶7），不看当前问题。检索、对话历史这类要按问题挑内容的输入，困惑度高不等于与问题相关。
- 评测的输入是 few-shot 示例、对话和论文，GSM8K 的完整提示词只有 2,366 token（Tab. 2），没有测工具输出、代码或 agent 轨迹。这些内容里低困惑度的 token（如重复出现的变量名）可能正是后续步骤要用的。
- 压缩后的提示词人读不懂（§5.5¶8），出错时难以排查，也难以审计提示词里删掉了什么。
- 成本估算按 GPT-3.5-Turbo 当时的标价计（Tab. 7），延迟只在单张 V100 上测（Tab. 6）。
- venue 按 arXiv comment 记为 EMNLP 2023，全部作者署名 Microsoft Corporation。

## 与其他工作的关系

- 与 Selective-Context：LLMLingua 的直接前作，同样用小模型的信息量删内容；LLMLingua 加了预算控制、迭代压缩和分布对齐（§2.1¶4）。Selective-Context 本库没有收录原文。
- 与 soft prompt 压缩：另一类方法通过 prompt tuning 学习特殊 token 来缩短输入（§2.1¶2），要改目标模型或针对特定任务训练；LLMLingua 只在输入的文字层面删减。
- 与 [You don't need long context](./202611-you-dont-need-long-context.md)：两者都让每次调用的输入变短，做法不同。LLMLingua 由外部小模型逐 token 删减，NVIDIA 的频繁压缩由执行任务的模型写交接摘要（[NVIDIA 论文](./202611-you-dont-need-long-context.md) §2.4.1）。LLMLingua 作者报告 GPT-4 改写式压缩会丢推理步骤（§5.3¶2），这与频繁压缩的思路有冲突，但两者的任务不同，没有直接对照，见[提示词压缩](../concepts/prompt-compression.md#共识与分歧)。
- 与 [ACE](./202510-ace.md)：方向相反。LLMLingua 删掉冗余以省成本，ACE 作者认为上下文应当保留详细的领域策略，把压缩看作信息损失（[ACE](./202510-ace.md) §1¶4）。两者处理的对象也不同：LLMLingua 压缩每次调用的输入，ACE 积累跨任务的 playbook。
- 与 [Lost in the Middle](./202307-lost-in-the-middle.md)：LLMLingua 保留原有顺序，只删不排；Lost in the Middle 建议把相关内容挪到输入开头（[Lost in the Middle](./202307-lost-in-the-middle.md) §5¶3），两者可以组合，LLMLingua 没有测位置的影响。
