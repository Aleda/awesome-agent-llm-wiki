---
title: Context Language Models
type: paper
summary: 把实时上下文镜像成文件，让模型用 Bash 自由编辑，长程任务上更准也更省算力
topics: [context]
aliases: [CLM, CLMs, 上下文语言模型]
added: 2026-11-27
date: 2026-09-29
url: https://arxiv.org/abs/2609.37725
source_dir: sources/papers/2609.37725
venue: arXiv
code: https://github.com/facebookresearch/context-language-models
pages: 27
by:
  - { entity: uw, role: org }
  - { entity: meta, role: org }
  - { name: MIT, role: org }
  - { name: Trillium Labs, role: org }
  - { name: Rulin Shao, role: author }
  - { name: Shannon Zejiang Shen, role: author }
  - { name: Junjie Oscar Yin, role: author }
  - { name: Yuetai Li, role: author }
  - { name: Minheng Wang, role: author }
  - { name: Hamish Ivison, role: author }
  - { name: Radha Poovendran, role: author }
  - { name: Nathan Lambert, role: author }
  - { name: Teng Xiao, role: author }
  - { name: Mike Lewis, role: author }
  - { name: Wen-tau Yih, role: author }
  - { name: Luke Zettlemoyer, role: author }
  - { name: Pang Wei Koh, role: author }
relations:
  - { concept: model-managed-context, rel: extends, note: 把实时上下文镜像成文件，模型用 Bash 任意改写，不再局限于人预先定义的压缩、卸载、检索动作 }
  - { concept: suffix-cache-reuse, rel: proposes, note: 上下文中段被改写后，复用未改动后缀的旧 KV cache 并重排位置编码，只预填新插入的 token }
  - { concept: success-gated-efficiency-reward, rel: extends, note: 在 stepwise GRPO 里只在成功轨迹之间按 prefix-reuse FLOPs 给效率优势，把效率信号从长度换成含重算的推理成本 }
---

## 新认知

- **作者认为上下文管理应当是模型的原生能力：把实时上下文交给模型任意改写，比人设计的压缩、卸载、检索策略效果更好（§1¶1）**，这一路线见[模型自管理上下文](../concepts/model-managed-context.md)。
- 固定策略的问题出在策略本身：作者用 [ContextBench](../glossary.md#contextbench) 把上下文管理和推理、知识能力拆开测，现有方法在这些简单合成任务上都做不到满分（§3¶2），对应[模型自管理上下文](../concepts/model-managed-context.md#设计空间)里的 harness 规则与动作空间两条路线。
- **上下文管理一旦由模型执行，就能像其他技能一样在上下文里学：一句提示词就能改变压缩时机和边界（§5.2¶2），进化出的技能文档在 ContextBench 留出集上最多提升 35.9 个点（§1¶6）**，不改权重，见[模型自管理上下文](../concepts/model-managed-context.md)。
- 用 RL 学上下文管理时，结果奖励对编辑行为的监督太弱，作者让效率优势只在成功轨迹之间按推理成本重新排序（§4.2¶6），即[成功门控的效率奖励](../concepts/success-gated-efficiency-reward.md)。
- **中段编辑会让前缀缓存失效，所以成本要按含重算的 [prefix-reuse FLOPs](../glossary.md#prefix-reuse-flops) 计（§4.1¶5）；作者据此设计[后缀缓存复用](../concepts/suffix-cache-reuse.md)，在 BrowseComp-Plus 上用标准 SGLang 65.0% 的 FLOPs 达到相同表现（§5.3¶1）**。
- 零样本的 CLM 会自己发明管理手段：给子 agent 维护计分板并原位更新 163 次，同时把上下文保持在 6–8K token（§4.1¶4），还会新建 notes 角色、定义可复用的压缩函数（Fig. 3），这是[模型自管理上下文](../concepts/model-managed-context.md)相对固定动作空间的直接收益。
- 收益依赖模型能力：作者报告 [Qwen](../glossary.md#qwen)3.5-9B 在训练前比摘要 harness 低 6 个点，RL 之后才追平（§5.2¶4）；但附录另一组设置下同一模型的 CLM 略高于摘要（Fig. 19），小模型能否直接用[模型自管理上下文](../concepts/model-managed-context.md#开放问题)还没有定论，见下文「局限与疑点」。
- 作者提醒可编辑上下文是新的攻击面，注入或模型自己生成的指令可以借它跨轮次留存（§6¶1），这是[模型自管理上下文](../concepts/model-managed-context.md#开放问题)要单独处理的安全问题。

## 核心问题

现有做法要么由 harness 按固定规则改写上下文（到长度阈值就摘要、每轮重写），要么让模型在人预先定义的几个动作里选（何时压缩、压缩哪一段、卸载和取回），模型的自主度在增加，但始终限于人设计的动作空间（§2¶1）。遇到需要逐字保留或局部更新的任务，这些策略会丢信息或留下冗余（§3¶2）。本质上，上下文的状态转移函数由人写死了，这是一个策略搜索被人工先验限制的问题；作者想把它变成模型自己可以搜索和学习的函数（§1¶1）。

## 核心洞察

标准 LM 的上下文只能追加：下一轮上下文等于当前上下文接上新输出。如果让模型直接产出下一轮的完整上下文，已有的压缩、卸载、检索工具都成了它的特例（§4.1）。要实现这一点不需要新接口：把上下文当成文件，通用的 Bash 和脚本就能完成任意改写（§4.1¶2）。

## 核心设计

1. **上下文即文件**：系统把模型的实时上下文镜像成一个文件，路径写在系统提示里；模型用 Bash 编辑它，改动在下一轮同步给推理服务；模型不改文件时，新输出照常追加（§4.1¶2）。这样既保留了追加时的缓存复用，又允许任意编辑。
2. **多智能体扩展**：多个上下文文件可以同时存在，agent swarm 用多个文件初始化，子 agent 的创建和结束就是新建和删除上下文文件（§4.1¶3）。
3. **按 prefix-reuse FLOPs 计成本**：前缀缓存只复用第一个不匹配位置之前的部分，中段编辑后的内容都要重新预填；作者把解码、预填和重预填都算进轨迹成本（§4.1¶5），避免"上下文变短"被误当成"更省"。
4. **技能进化**：每轮让 agent 在训练集上跑任务，由提议模型读轨迹写出候选技能文档，在开发集上选优（§4.2¶4）；提议者可以是更强的外部模型，也可以是 agent 自己（Fig. 10）。
5. **stepwise GRPO 加成功门控效率优势**：结果奖励监督不到具体编辑，直接奖励编辑次数又会诱导模型乱删信息；所以只在成功轨迹之间按 prefix-reuse FLOPs 给额外优势，失败轨迹不拿效率分（§4.2¶6）。
6. **后缀缓存复用（SCR）**：编辑后保留未改动 token 的旧缓存，只预填新插入部分（Fig. 4）；对线性注意力层改用编辑前的循环状态快照（Fig. 12），每次编辑最多搬移 K 段以限制近似误差（Fig. 13）。

## 效果

| 设置 | 基线 | 结果 | 锚点 |
|---|---|---|---|
| [BrowseComp-Plus](../glossary.md#browsecomp-plus)，Qwen3.6-27B，32K 上下文，零样本 | Codex 式摘要（最强基线） | 准确率 59.4%，相对高 11.4%；prefix-reuse FLOPs 少 21.5% | （§5.1.1¶2） |
| [TerminalBench](../glossary.md#terminalbench) 2.1 / [TBLite](../glossary.md#tblite)，Qwen3.6-27B，32K | Codex 式摘要 | TB2.1 打平，FLOPs 为基线的 70%；TBLite 73.7% 对 67.0%，FLOPs 为 91% | （§5.1.1¶2） |
| 四个数学优化问题，Claude 4.6 Sonnet，32K | [OpenEvolve](../glossary.md#openevolve) | 四题均优于 OE 和 OE-Agent；circle packing 2.618 对 2.541（带子 agent 为 2.636），[Heilbronn](../glossary.md#heilbronn-triangle-problem) 0.03653 对 0.03127 | （Tab. 1） |
| [EdgeBench](../glossary.md#edgebench)-10，12 小时单仓库优化，Qwen3.6-27B，32K | Codex 式摘要 | 44.6（179 PFLOPs）对 42.3（437 PFLOPs） | （§5.1.2¶3） |
| EdgeBench-10，Claude 4.6 Sonnet，32K | Codex 式摘要 | 51.0 对 42.3 | （§5.1.2¶3） |
| [Software World](../glossary.md#software-world)，六 agent 24 小时多仓库优化，GPT-5.6-Sol | 摘要式 agent swarm，同等花费 | 下游加速多 65% | （§5.1.2¶4） |
| ContextBench 技能进化，留出集 | 无上下文管理指令的起点 | 最多提升 35.9 个点，计算量更低 | （§1¶6） |
| RL，Qwen3.5-9B，在 OpenResearcher 上训练、BrowseComp-Plus 上评测 | 同样训练的摘要 harness：34.7% → 42.1%，4.01 → 2.19 PFLOPs/题 | CLM：28.8% → 42.5%，1.52 → 1.34 PFLOPs/题 | （Tab. 2） |
| SCR，BrowseComp-Plus，Qwen3.6-27B | 标准 [SGLang](../glossary.md#sglang) | 表现持平，prefix-reuse FLOPs 为基线的 65.0% | （§5.3¶1） |

## 局限与疑点

### 作者承认的

- 可编辑上下文可能让提示注入或模型自生成的指令跨轮次留存，需要新的防御（§6¶1）。
- 现有模型估计自己用了多少上下文的能力有限，长上下文下更差，环境里的 token 计数提示能明显改善（Fig. 30）。
- SCR 复用的是编辑前算出的状态，留存的后缀缓存仍编码着旧前缀，属于近似复用（§4.3¶1）；作者因此限制每次编辑搬移的段数（Fig. 13）。
- 混合架构下 SGLang 的前缀缓存实现本身还留下大量未改动前缀的重复预填，SCR 解决不了这部分（Fig. 15）。

### 本库判断的

- 小模型的结论随设置变化：§5.2 的 RL 设置里，Qwen3.5-9B 训练前的 CLM 比摘要 harness 低 6 个点（§5.2¶4）；附录主实验设置里，同一模型的 CLM 在 BrowseComp-Plus 上是 39.9%，高于摘要的 37.7%（Fig. 19）。两处的上下文预算、轮数上限和评判模型不同，"小模型不会管上下文"这一归因需要更直接的对照。
- RL 结果的措辞前后不一：同样是 42.5% 对 42.1%，§1 写作以 0.4 个点"超过"同样训练的摘要 harness（§1¶6），§5.2 写作"追平"（§5.2¶4）。差距只有 0.4 个点，本库按"追平"理解。
- SCR 的收益大半与模型编辑无关：BrowseComp-Plus 上 SCR 在前缀命中之外额外复用了 7.8% 的 prompt token，其中 5.3 个点来自对话模板剥离推理 token，只有 2.5 个点来自上下文编辑（Fig. 14）。SCR 更像一项通用的推理服务优化。
- 成本口径是理论 prefix-reuse FLOPs（§4.1¶5），没有报告墙钟时间或吞吐，实际部署的收益还要看推理框架。
- RL 结果只有 Qwen3.5-9B 一个模型、深度研究一类任务（Tab. 2），能否推广到编程和长程优化任务还没有证据。
- 原文没有写投稿会议，arXiv 元数据的 comment 字段为空，所以 venue 记为 arXiv。

## 与其他工作的关系

- 与 Self-Compact、AutoCompact、ACM、Sculptor：同一条"把控制权交给模型"的路线，后者都限于人定义的动作，CLM 把动作空间放开到任意编辑（§2¶1）。本库把它们都归在[模型自管理上下文](../concepts/model-managed-context.md#设计空间)下比较。
- 与 Recursive Language Models（RLM）：RLM 让模型决定读入什么，但取回的内容仍追加进实时上下文；CLM 管的是实时上下文本身，作者认为两者可以组合（§2¶2）。
- 与 harness 优化：作者把 harness 看作可以先在外部开发、再蒸馏进模型权重的程序性知识，并提出 harness 到 CLM 的蒸馏方向（§6¶2）。这和 memory 方向的"程序性记忆"说法接上了，但论文只给了设想，没有实验。
