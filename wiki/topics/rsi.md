---
title: RSI
type: topic
summary: AI 系统能否实质性加速改进自身的研究，以及这种闭环的边界
aliases: [recursive self-improvement, 递归自我改进]
added: 2026-11-26
order: 3
---

## 这个方向在解决什么

截至 2026-11，改进 AI 系统的工作，包括提出假设、写训练代码、跑实验和分析结果，大部分仍由人完成。RSI（recursive self-improvement）问的是：AI 系统能否承担其中足够多的部分，使改进它自己的研究明显加速，以及这种加速能否一代代叠加。技术上的问题是模型能否为自己生成有用的训练数据、奖励信号或代码改动。度量上的问题是怎样判断这种加速已经发生到什么程度，以及闭环里人还保留哪些控制点。

## 概念地图

### 自我生成的训练信号

- [自举推理](../concepts/bootstrapped-reasoning.md)：用模型自己生成、按答案对错筛过的推理过程再训练自己，最早来源是 [STaR](../papers/202203-star.md)。
- [自我奖励](../concepts/self-rewarding.md)：模型同时充当被训练者和评判者，最早来源是 [Self-Rewarding Language Models](../papers/202401-self-rewarding-language-models.md)。

两者的区别在谁判定数据好坏：自举推理靠每道题的标准答案，自我奖励靠模型自己打分。

### 自我修改的程序与 agent

- 进化式代码搜索：LLM 提出程序改动，评测器打分，保留更好的版本（如 [OpenEvolve](../glossary.md#openevolve)）。
- [自我修改的 agent](../concepts/self-modifying-agent.md)：agent 改写自己的代码或 harness，用 benchmark 验证改动，本库收录的来源是 [Darwin Gödel Machine](../papers/202505-darwin-godel-machine.md)。

### 自动化研究

- [自动化 AI 研究](../concepts/automated-ai-research.md)：把 AI 研发的执行、设计和选题逐级交给 AI，直到端到端做研究、构建自己的后继者；端到端论文 agent 的例子是 [The AI Scientist](../papers/202408-ai-scientist.md)。谁先受益有分歧：头部实验室的复利加速，还是没有历史 infra 包袱的 NeoLab。
- 研究工程能力的评测：复现已发表的结果、完成 ML 工程任务。

### 度量与治理

- [AI 研发加速度量](../concepts/ai-rd-uplift-measurement.md)：用什么指标判断 AI 已经实质性加速了 AI 研究；外部基准、内部产出量、受控研究任务各能说明什么。
- [AI 研发中的人类瓶颈](../concepts/human-bottleneck-in-ai-rd.md)：执行交给 AI 后，人工审查和定研究方向（研究品味）成为整体速度的上限，也是闭环中人保留的控制点。
- [可验证的协调放缓](../concepts/verifiable-coordinated-slowdown.md)：多家前沿实验室在能相互核实的前提下同时放缓或暂停。

## 关键争论

- 闭环 RSI 是否等于 takeoff：AI 参与改进自身，和能力快速且难以控制地增长，中间还隔着哪些条件，如算力、数据和评测瓶颈。
- 评测器瓶颈：现有自我改进方法依赖可以自动判定的分数，在没有可靠评测器的任务上是否成立。本库收录的几份素材分别站在这个问题的不同位置：
  - 有标准答案时：[STaR](../papers/202203-star.md) 用答案对错筛推理，但作者说随机猜中率高的任务会留下大量差的推理，怎样过滤是开放问题（[STaR](../papers/202203-star.md) §6¶2）。
  - 用模型自己当评判者：[Self-Rewarding](../papers/202401-self-rewarding-language-models.md) 的自评与人工排序的一致率在加入人工排序筛过的评判种子数据后从 65.1% 升到 78.7%，之后两轮自我训练再升到 81.7%（[Self-Rewarding](../papers/202401-self-rewarding-language-models.md) Tab. 4），但数学和逻辑推理类任务没有提升（[Self-Rewarding](../papers/202401-self-rewarding-language-models.md) §3.2.1¶6），作者也承认还没分析是否发生 reward hacking（[Self-Rewarding](../papers/202401-self-rewarding-language-models.md) §6¶3）。
  - 用现成 benchmark 打分：[DGM](../papers/202505-darwin-godel-machine.md) 假设 coding benchmark 分数就代表自我改进能力（[DGM](../papers/202505-darwin-godel-machine.md) §6¶3），并担心 benchmark 测不到的问题会在代际间放大（[DGM](../papers/202505-darwin-godel-machine.md) §5¶1），见[自我修改的 agent](../concepts/self-modifying-agent.md#共识与分歧)。
  - 开放研究问题：[The AI Scientist](../papers/202408-ai-scientist.md) 用 LLM 评审员给论文打分，balanced accuracy 0.65 对人类基线 0.66，假阳性率 0.31 对 0.17（[The AI Scientist](../papers/202408-ai-scientist.md) Tab. 1），作者仍建议人工检查实现再信结果（[The AI Scientist](../papers/202408-ai-scientist.md) §8¶3），见[自动化 AI 研究](../concepts/automated-ai-research.md#共识与分歧)。
  - NeoCognition 联创谷雨认为，数学开放问题被 informal 方法接连解决，说明不靠 Lean 一类形式化验证提供信号也能走得很远（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:13:16]–[00:14:16]）；但数学题有明确对错，这对选研究目标这类没有标准答案的判断能说明多少，播客没有讨论。
- 先发者的积累是资产还是负担：Anthropic 描述的加速发生在头部实验室自己的流程里，并判断最可能的前景是实验室效率复利增长（[Anthropic blog](../blogs/20260918-anthropic-when-ai-builds-itself.md) §4¶8）。谷雨认为 AI 写 infra 和 recipe 的能力超过人之后，头部公司的历史 infra 会成为负担，NeoLab 可能加速更快（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:02:04]–[00:03:05]），见[自动化 AI 研究](../concepts/automated-ai-research.md#共识与分歧)。
- 加速有多少来自 AI：研究效率的提升里，有多少能归因于 AI 系统本身，多少来自工具链和人的组织方式。Anthropic 用合入代码占比和人均代码量等内部数据论证加速已经发生（[Anthropic blog](../blogs/20260918-anthropic-when-ai-builds-itself.md) §2¶4），这些指标量的是产出，作者也承认行数高估生产率（[Anthropic blog](../blogs/20260918-anthropic-when-ai-builds-itself.md) §2¶5），见[AI 研发加速度量](../concepts/ai-rd-uplift-measurement.md#共识与分歧)。
- 研究品味能否自动化：反方认为仍在人手里的选题判断最重要（[Anthropic blog](../blogs/20260918-anthropic-when-ai-builds-itself.md) §4¶1）；Anthropic 认为即使不能自动化，加速也会复利（[Anthropic blog](../blogs/20260918-anthropic-when-ai-builds-itself.md) §4¶3），并设想了从趋势停滞到完全递归自我改进的三种前景（[Anthropic blog](../blogs/20260918-anthropic-when-ai-builds-itself.md) §4¶7），见[AI 研发中的人类瓶颈](../concepts/human-bottleneck-in-ai-rd.md#三种前景)。
- 放缓是否可行：Anthropic 认为单方面暂停只会换掉领跑者（[Anthropic blog](../blogs/20260918-anthropic-when-ai-builds-itself.md) §5¶4），主张以可核实为前提的协调放缓（[Anthropic blog](../blogs/20260918-anthropic-when-ai-builds-itself.md) §5¶2），见[可验证的协调放缓](../concepts/verifiable-coordinated-slowdown.md)。

## 最近进展
