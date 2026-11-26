---
title: You don't need long context
type: paper
summary: 频繁压缩加按需读取，把上下文压到 16K–48K，长程和长输入任务基本不掉点
topics: [context]
aliases: []
added: 2026-11-27
date: 2026-11-03
url: https://arxiv.org/abs/2611.05306
source_dir: sources/papers/2611.05306
venue: arXiv
pages: 31
by:
  - { entity: nvidia, role: org }
  - { name: Peter Belcak, role: author }
  - { name: Saurav Muralidharan, role: author }
  - { name: Jindong Jiang, role: author }
  - { name: Yonggan Fu, role: author }
  - { name: Wonmin Byeon, role: author }
  - { name: Hanrong Ye, role: author }
  - { name: Ryan Angilly, role: author }
  - { name: Ali Taghibakhshi, role: author }
  - { name: Shih-Yang Liu, role: author }
  - { name: Siru Ouyang, role: author }
  - { name: Greg Heinrich, role: author }
  - { name: Pavlo Molchanov, role: author }
relations:
  - { concept: frequent-context-compaction, rel: proposes, note: 把压缩阈值压到 16K–48K、极端时每个动作后压缩一次，配合按需读取长输入，长程和长输入任务的准确率基本保持 }
  - { concept: semantic-state-space-model, rel: proposes, note: 设想把单动作压缩后训练进模型，每轮读写一段自然语言状态，代替累积完整对话历史 }
  - { concept: interleaved-reasoning-acting, rel: applies, note: 两种基础 harness 都是极简 ReAct 循环，每轮发一个 Bash 动作，动作和结果逐条追加进对话 }
---

## 新认知

- **长上下文的代价主要落在服务端：三个开源模型把 context window 从 256K 配到 16K，H100 上的解码吞吐分别高 3.6、5.6、7 倍（Fig. 4），而零售价按每百万 token 固定计价，用户看不到这部分差价（§1¶1）**；作者据此认为窗口应当按任务实际需要收缩（§6¶3），这是[频繁上下文压缩](../concepts/frequent-context-compaction.md)的经济前提。
- **作者认为长程任务不需要长上下文：压缩阈值一路收紧到 16K/12K，Claude Opus 4.5 和 GPT 5.6 Sol 在 22 个配置里各自最多 5 个掉点超过 2 个点（§3¶4）**，完整历史一直留在上下文里的必要性比通常设想的低，见[频繁上下文压缩](../concepts/frequent-context-compaction.md)。
- 长输入任务可以化成长程任务：把输入存成环境里的文件，让 agent 用 grep 和有界读取按需取证据（§1¶8）；作者报告这样做在 7 个长输入 benchmark 上几乎全部持平或更好，并据此认为输入规模本身不构成需要长上下文的理由（§4¶7），见[频繁上下文压缩](../concepts/frequent-context-compaction.md#设计空间)。
- 压缩有损，作者也承认（§3.1¶2），多跳检索的 [FRAMES](../glossary.md#frames) 上两个模型在每个压缩配置下都低于完整历史（Tab. 6）；作者的补救是把完整历史存档并配一个选择性读取工具，把"需要历史"转成长输入问题（§3.1¶4），于是[频繁上下文压缩](../concepts/frequent-context-compaction.md#共识与分歧)和检索式上下文成了一条组合路线。
- 压缩频率可以推到每个动作一次：单动作压缩（SAC）下中位峰值上下文只有 7–9K token（§5¶2），作者认为准确率没有崩溃（§5¶3）；Opus 4.5 在两个 benchmark 上持平或高于完整历史，GPT 5.6 Sol 低 2.0 和 3.3 个点（§5¶2），且低于它的全部四档 EoCC（Tab. 3、Tab. 5），所以把频率推到极限的代价因模型而异，见[频繁上下文压缩](../concepts/frequent-context-compaction.md#设计空间)。
- 作者由 SAC 引出[语义状态空间模型](../concepts/semantic-state-space-model.md)：后训练一个模型，每轮读入一段自然语言描述的对话状态、行动、再改写这段状态（§5.1¶2），并推测这比训练完整历史模型更省数据（§5.1¶3），但论文没有训练实验。
- **本库判断：长程任务上的省钱倍数取决于作者假设的定价模型，按现行标价，GPT 5.6 Sol 在 [SWE-bench](../glossary.md#swe-bench) Verified 上压缩后反而更贵（$167.68 升到 $184.16–$203.12），因为每次重开对话都会让此前的缓存作废，缓存命中的输入从 100.2M 降到 45.8M–94.2M token（Tab. 3）**；要兑现节省，服务方得按窗口大小部署和定价，见[频繁上下文压缩](../concepts/frequent-context-compaction.md#开放问题)。
- 压缩的鲁棒性依赖模型：开源的 Qwen 3 Coder Next 在 16K/12K 下 SWE-bench Verified 从 53.0% 掉到 3.6%（Tab. 9），和 CLM 论文里小模型训练前管不好上下文的观察方向一致（[CLM](./202609-context-language-models.md) §5.2¶4），见[频繁上下文压缩](../concepts/frequent-context-compaction.md#开放问题)。

## 核心问题

主流模型的 context window 已到 200K 至 1M 以上（Tab. 1），agent 默认把全部交互历史和全部长输入放进上下文；而生成代价随上下文深度增长，作者测的三个开源模型在 256K 窗口下每个生成 token 比 16K 贵 3.6–7 倍（Fig. 1）。作者认为模型一直在追着输入变长，没有朝效率优化（§1¶5）。本质问题是：长程任务和长输入任务需要的究竟是"大量 token 同时在场"，还是每一步只需要一份有界的信息；如果是后者，长上下文就只是一个昂贵的工程默认值，可以用压缩和按需读取替换（§6¶2）。

## 核心洞察

长输入任务总能化为长程任务：输入存进环境，模型用工具选择性读取（§1¶8）。长程任务每一步只需要任务本身、当前进度和与后续执行相关的事实，完整历史可以换成一份有界的状态；确实需要回看的历史，也可以存档后按需取回（§3.1¶6、§3.1¶4）。

## 核心设计

1. **三种上下文管理方式对照**（§2.4.1、Fig. 3）：全历史累积（FHA）作基线；对话结束式压缩（EoCC）在上下文超过阈值时让模型写一份有界的交接摘要，harness 用"原任务 + 摘要"开新对话；单动作压缩（SAC）每个对话只做一个动作，随后更新语义状态并丢弃对话。三者共用同一个 [mini-swe-agent](../glossary.md#mini-swe-agent) 式 ReAct 循环（§2.4），只改上下文管理这一个变量。
2. **逐级收紧阈值**：长程任务的"总上限 / 压缩阈值"从 48K/36K 依次降到 16K/12K，BFCLv3 最低到 12K/8K，τ²-bench 最低到 8K/6K（§3），看准确率和成本怎样随压缩频率变化。
3. **选择性读取长输入**：长输入以文件形式放在 agent 的文件系统里，初始消息只列出文件，agent 用 grep、sed 和有界读取命令取证据（§2.4.2）。这样长输入任务的处理方式和长程任务统一。
4. **按后续执行挑选压缩内容**：压缩提示要求保留任务原文、当前进度和下一步计划、与后续执行直接相关的产物。作者在附录 A 报告，按摘要的思路平均对待历史里的所有事实效果更差，好的压缩是给后续执行挑出的简报（§2.4.1）。
5. **成本按窗口大小估算**：在 H100 上用 vLLM 实测不同窗口配置下的峰值解码吞吐（§2.5、Fig. 4），拟合出 16K 与 256K 的成本比（§2.3），再把前沿闭源模型的标价从完整窗口线性插值到 16K，得到[估计优化零售成本](../glossary.md#estimated-optimized-retail-cost)；推导在论文附录 B，各结果表的估计成本列都按它折算（Tab. 3）。本地另在 [DGX Spark](../glossary.md#dgx-spark) 上测延迟和显存（Fig. 2）。

## 效果

| 设置 | 基线 | 结果 | 锚点 |
|---|---|---|---|
| SWE-bench Verified，Claude Opus 4.5，EoCC | FHA 70.0% | 24K/18K 74.8%；16K/12K 68.8% | （Tab. 3） |
| SWE-bench Verified，GPT 5.6 Sol，EoCC | FHA 84.4% | 48K/36K 88.8%；16K/12K 84.6% | （Tab. 3） |
| 同上，GPT 5.6 Sol 的成本 | FHA 按标价 $167.68 | 各压缩配置按标价 $184.16–$203.12；按估计优化零售成本 $40.62–$55.82 | （Tab. 3） |
| 6 个长程 benchmark 共 22 个压缩配置 | 各自 FHA | Opus 4.5 −3.7 至 +5.6 个点，GPT 5.6 Sol −3.3 至 +4.4；每个模型至多 5 个配置掉点超过 2 个点；估计成本节省 2.2–8.8 倍、2.4–5.0 倍 | （§3¶4） |
| FRAMES，16K/12K | FHA：Opus 4.5 81.0%，GPT 5.6 Sol 90.2% | 79.6%、87.1% | （Tab. 6） |
| 7 个长输入 benchmark，选择性读取 + EoCC | 全量输入 | Opus 4.5 −0.4 至 +40.0 个点，GPT 5.6 Sol +1.0 至 +30.9；估计成本节省 6.5–54.6 倍、4.4–233.3 倍 | （§4¶4） |
| [AA-LCR](../glossary.md#aa-lcr)，16K/12K | 全量输入：Opus 4.5 65.0%，GPT 5.6 Sol 82.0% | 84.0%、83.0% | （Tab. 13） |
| [LOONG](../glossary.md#loong)，48K/40K，平均分 / 完全正确率 | Opus 4.5 70.1 / 38.9，GPT 5.6 Sol 79.3 / 44.4 | 79.8 / 52.6、84.6 / 53.0 | （Tab. 12） |
| [RULER](../glossary.md#ruler)，16K/12K，平均召回 | Opus 4.5 62.5%，GPT 5.6 Sol 65.5% | 95.7%、96.4% | （Tab. 15） |
| SAC，Claude Opus 4.5，SWE-bench Verified / [TerminalBench](../glossary.md#terminalbench) 2.1 | FHA 70.0 / 47.2；最佳 EoCC 74.8 / 52.8 | 70.2 / 51.8；峰值上下文中位数 8K / 9K | （Tab. 2） |
| SAC，GPT 5.6 Sol，同上 | FHA 84.4 / 87.6；最佳 EoCC 88.8 / 88.8 | 82.4 / 84.3 | （Tab. 2） |
| 开源 Qwen 3 Coder Next，SWE-bench Verified，16K/12K | FHA 53.0% | 3.6% | （Tab. 9） |
| 解码吞吐，H100 + vLLM，窗口 256K 改为 16K | 256K 配置 | GLM 5.2 3.6 倍，Kimi K2.6 5.6 倍，Qwen 3 Coder Next 7 倍 | （Fig. 4） |

## 局限与疑点

### 作者承认的

- 压缩是有损的，可以构造必然失败的任务，例如要求回看第 i 次掷硬币结果（§3.1¶2）；作者的补救是历史存档加选择性读取（§3.1¶4），但没有实验验证这一补救。
- 证据不排除存在受益于长上下文的任务，也不证明所有任务都能用短上下文完成（§6¶3）。
- 开源模型对压缩的鲁棒性差别很大，Qwen 3 Coder Next 在 16K/12K 下的 SWE-bench Verified 几乎全部失败（Tab. 9）；作者在论文附录 D 把原因归于它的轨迹太冗长，两次压缩之间留不出有效工作的空间。
- [NIAH](../glossary.md#niah) 上两个模型都拿到满分（Tab. 14），作者在论文附录 F 把它归因于针和问题之间有直接的词面重合，便于检索。
- SSSM 只是设想，"更省数据"是推测（§5.1¶3）。

### 本库判断的

- 长程任务的省钱倍数是模型估算。估计优化零售成本假设价格随部署的窗口大小从标价线性降到 16K 时的约 20%（推导在论文附录 B）。按标价，GPT 5.6 Sol 在 22 个长程配置里有 21 个比基线贵，Opus 4.5 有 7 个（Tab. 3、Tab. 4、Tab. 5、Tab. 6、Tab. 7、Tab. 8）。原因是每次压缩都重开对话，重开处之前的缓存作废，缓存命中的输入减少；GPT 5.6 Sol 在 SWE-bench Verified 上的输出 token 也从 3.1M 增到 3.9M–5.3M（Tab. 3）。
- 吞吐收益来自部署时配置的窗口大小，测量时请求长度在窗口内均匀抽样（§2.5、Fig. 4）。单个 agent 在 256K 端点上自己压缩，服务方的成本不会因此下降，需要专门的短窗口部署。作者把节省归于只服务更短的窗口（§4¶4），也设想云上窗口可以大幅缩小（§6¶3），但没有讨论服务方是否会、怎样按窗口分档部署和定价。
- 长输入上的大幅提升主要来自选择性读取：RULER 和 BABILong 上压缩次数的中位数是零（Tab. 15、Tab. 17）。原文只说基线收到 benchmark 规定的全部输入（§4）；NIAH 的输入长到约 500K token，超出 Opus 4.5 的 200K 窗口（§2.2、Tab. 1），基线怎样处理超长输入没有交代，部分提升可能反映的是基线的失败方式。
- "每个动作后都能压缩"对 Opus 4.5 成立，对 GPT 5.6 Sol 有损：后者低于完整历史 2.0–3.3 个点，比最佳 EoCC 低 6.4 个点（Tab. 2）。"最佳 EoCC"是四档里挑出的最好一档，拿它和单次 SAC 运行比会放大差距；逐档看，Opus 4.5 的 SAC 高于 SWE-bench Verified 上 16K/12K 的 EoCC（Tab. 3），也高于 Terminal-Bench 上四档中的三档（Tab. 5）。SSSM 能追平完整历史模型（§5.1¶3）目前没有证据。
- 主实验只有两个闭源模型，harness 是每轮一个 Bash 动作的极简 ReAct 循环（§2.4）。带并行工具调用、子 agent 或人类反馈的工作流没有测。
- 原文没有单独的机构署名，本库依据论文链接的 NVIDIA Research 实验室页面和 NVIDIA 硬件把机构记为 NVIDIA。arXiv comment 字段写作 Technical report，31 页。

## 与其他工作的关系

- 与 [Context Language Models](./202609-context-language-models.md)：两篇都认为把完整历史一直留在上下文里不划算，都把实时上下文压在几十 K 以内。分歧在由谁决定：CLM 认为固定规则在需要逐字保留的任务上会丢信息，主张把编辑权交给模型（[CLM](./202609-context-language-models.md) §3¶2）；本文用 harness 按阈值触发、模型按模板写交接摘要，在真实 benchmark 上就接近或超过完整历史（§3¶4）。两篇没有直接对比，CLM 的最强基线 Codex 式摘要与本文的 EoCC 机制相近，CLM 在 BrowseComp-Plus 上比它高 11.4%（相对值）（[CLM](./202609-context-language-models.md) §5.1.1¶2）。本库把两条路线并列在[模型自管理上下文](../concepts/model-managed-context.md#设计空间)的设计空间里。
- 成本口径：CLM 用 prefix-reuse FLOPs 把中段编辑后的重预填算进成本（[CLM](./202609-context-language-models.md) §4.1¶5）；本文按新输入、缓存输入、输出分别计价，压缩后缓存命中下降（Tab. 3）。两篇都说明"上下文变短"不等于"更省"，要看推理服务怎样复用缓存，见[后缀缓存复用](../concepts/suffix-cache-reuse.md)。
- SSSM 与 CLM 的"把 harness 操作蒸馏进权重"（[CLM](./202609-context-language-models.md) §6¶2）方向相同，都想让上下文管理成为模型后训练得到的能力；SSSM 把状态限定为每个动作后重写的一段自然语言（§5.1¶2）。
- 与 State-Space Model（Mamba 一类）：SSSM 的名字借自 SSM，区别是状态是可读的自然语言，在对话轮次之间传递，SSM 的状态是 token 之间的神经网络隐状态（§5.1¶2）。
- 与 NIAH 一类长上下文 benchmark：作者在论文附录 F 讨论 NIAH 结果（Tab. 14）时认为，这类 benchmark 预设了"长上下文任务"的存在，而他们没有找到必须用长上下文才能完成的任务。
