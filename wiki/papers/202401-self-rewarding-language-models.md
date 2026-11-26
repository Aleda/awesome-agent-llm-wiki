---
title: Self-Rewarding Language Models
type: paper
summary: 同一个模型既生成回答又用 LLM-as-a-Judge 给自己打分，组成偏好对做迭代 DPO，评判能力也随之提升
topics: [rsi]
aliases: [Self-Rewarding, Self-Rewarding LM, Self-Rewarding LLM]
added: 2026-11-27
date: 2024-01-18
url: https://arxiv.org/abs/2401.10020
source_dir: sources/papers/2401.10020
venue: ICML 2024
pages: 23
by:
  - { entity: meta, role: org }
  - { entity: nyu, role: org }
  - { name: Weizhe Yuan, role: author }
  - { name: Richard Yuanzhe Pang, role: author }
  - { name: Kyunghyun Cho, role: author }
  - { name: Xian Li, role: author }
  - { name: Sainbayar Sukhbaatar, role: author }
  - { name: Jing Xu, role: author }
  - { name: Jason Weston, role: author }
relations:
  - { concept: self-rewarding, rel: proposes, note: 同一个模型既生成候选回答，又用 LLM-as-a-Judge 提示给这些回答打分，最高分和最低分组成偏好对做 DPO，逐轮迭代；奖励模型不再冻结，评判能力随指令跟随能力一起提升。作者把 Instruction Backtranslation 视为特定设置下的先例 }
---

## 新认知

- **Self-Rewarding 去掉了冻结的奖励模型：同一个模型为新指令生成候选回答，再用 [LLM-as-a-Judge](../glossary.md#llm-as-a-judge) 提示给它们打 0–5 分，最高分和最低分组成偏好对做 DPO，训练出的新模型进入下一轮（§1¶3、§2.2¶3、§2.3¶3）**，本库据此新建[自我奖励](../concepts/self-rewarding.md)。
- **作者的核心论点是评判能力也会随迭代变好：在 Open Assistant 留出的人类排序上，pairwise accuracy 从 M1 的 78.7% 升到 M2 的 80.4%、M3 的 81.7%，这两轮没有新增评判训练数据（§3.2.2¶3、Tab. 4）；但最大的一步是 SFT 基线 65.1% 到 M1 78.7%，来自由人工排序筛出的评判种子数据（§3.2.2¶2、§3.1.1¶2）**，见[自我奖励](../concepts/self-rewarding.md#共识与分歧)。
- AlpacaEval 2.0 上对 GPT-4 Turbo 的胜率从 M1 的 9.94% 升到 M3 的 20.44%，超过 Claude 2、Gemini Pro 和 GPT-4 0613（§3.2.1¶5、Tab. 1）；同期回答平均长度从 1092 涨到 2552，作者承认长度可能是相对表现的一个因素（§3.2.1¶7），见[自我奖励](../concepts/self-rewarding.md#开放问题)。
- 自我奖励主要让模型更好地使用已有知识：数学和逻辑推理类指令上胜率没有提升（§3.2.1¶6），MT-Bench 的数学、代码和推理类只从 M1 的 3.83 到 M3 的 4.17，低于其他类别的提升（Tab. 2），见[自我奖励](../concepts/self-rewarding.md#共识与分歧)。
- 评判信号的质量很依赖提示写法：同一个 SFT 基线，用作者的加分式评分提示 pairwise accuracy 为 65.1%，用 Li et al. 的分档式提示只有 26.6%（§3.2.2¶4），见[自我奖励](../concepts/self-rewarding.md#设计空间)。
- 作者报告只把自评高分的回答加进监督微调没有帮助，组成偏好对才有帮助（§4¶4），见[自我奖励](../concepts/self-rewarding.md#设计空间)。
- **循环里不只是模型自己：主实验的新指令由固定的 Llama 2-Chat 70B 生成（§2.2¶3、§3.1.3¶2），选 checkpoint 用 Claude 2 评测（§3.1.3¶1），最终评测主要用 GPT-4（§3.1.2¶2）**，见[自我奖励](../concepts/self-rewarding.md#共识与分歧)。
- 作者把结果称为初步结果：只在一种设置下跑了三轮，reward hacking 是否会发生、训练奖励和评测都用 LLM 打分的影响都还没分析（§6¶1、§6¶2、§6¶3），见[自我奖励](../concepts/self-rewarding.md#开放问题)。

## 核心问题

RLHF 从人类偏好学一个奖励模型，再冻结它来训练 LLM；DPO 跳过奖励模型直接用人类偏好训练。两条路都受人类偏好数据的规模和质量限制，RLHF 还受冻结奖励模型的质量限制（§1¶1）。本质上这是奖励信号来源的问题：评判者固定不变时，被训练的模型最多学到评判者能分辨的水平。

## 核心洞察

评判一个回答的好坏可以写成一条指令跟随任务（§2¶3），所以生成回答和评判回答可以放进同一个模型里一起训练，两种能力之间可以迁移（§1¶2）。这样奖励模型不再冻结，会随迭代一起改进（§2¶4）。

## 核心设计

1. **两份种子数据**：3,200 条 Open Assistant 的人写指令和回答做监督微调（IFT，§3.1.1¶1）；评判数据（EFT）由 SFT 基线按加分式提示给 Open Assistant 的多个人写回答打分，只保留分数排序与人工排序一致的样本，得到 1,630 条训练、541 条评测（§3.1.1¶2）。作者说 EFT 不是必需的，但能提升效果（§2.1¶2）。
2. **加分式评分提示**：从相关性、覆盖度、有用性、清晰度、专业性五条标准逐条加分，先写理由再给出 5 分制分数（§2.1¶2，Fig. 2）。
3. **自己造偏好数据**：用少量示例生成新指令，每条指令采样 4 个候选回答，由正在训练的模型打分，每个回答评 3 次取平均（§2.2¶3、§3.1.3¶2）；最高分和最低分组成一对，同分就丢弃，然后做 DPO（§2.3¶3）。
4. **迭代**：M1 是在 IFT+EFT 上监督微调的模型，M2 用 M1 造的偏好数据做 DPO，M3 用 M2 造的数据（§2.4¶3）；两轮分别新增 3,964 和 6,942 个偏好对（§3.1.3¶2）。作者说这与 Pairwise Cringe Optimization 的 Iterative DPO 相同，区别是那项工作用固定的外部奖励模型（§2.4¶4）。

## 效果

底座是 [Llama 2](../glossary.md#llama-2) 70B（§3.1¶1）。Head-to-head 和 [AlpacaEval](../glossary.md#alpacaeval) 由 GPT-4 判定（§3.1.2¶2）；评判能力用 Open Assistant 留出集上与人类排序的一致程度衡量（§3.1.2¶3）。

| 设置 | 基线 | 结果 | 锚点 |
|---|---|---|---|
| Head-to-head，256 条测试指令 | IFT+EFT 对只用 IFT | 30.5% 胜对 30.9% 胜，加评判数据不影响指令跟随 | （§3.2.1¶2） |
| Head-to-head | M1；SFT 基线 | M2 胜 55.5% 对 11.7%；M2 胜 49.2% 对 14.5% | （§3.2.1¶3） |
| Head-to-head | M2；SFT 基线 | M3 胜 47.7% 对 12.5%；M3 胜 62.5% 对 9.8% | （§3.2.1¶4） |
| AlpacaEval 2.0，对 GPT-4 Turbo 的胜率 | GPT-4 0613 15.76%；Gemini Pro 16.85%；Claude 2 17.19%；GPT-4 0314 22.07% | M1 9.94%；M2 15.38%；M3 20.44% | （Tab. 1） |
| [MT-Bench](../glossary.md#mt-bench) 总分（10 分制） | SFT 基线 6.85 | M1 6.78；M2 7.01；M3 7.25 | （Tab. 2） |
| MT-Bench 数学、代码和推理 | SFT 基线 3.93 | M1 3.83；M2 4.05；M3 4.17 | （Tab. 2） |
| NLP 基准 | Llama 2 70B；SFT 基线 | 大体持平，ARC-Challenge 从 M1 57.51 降到 M3 53.13，NQ 从 35.48 降到 31.86 | （Tab. 3） |
| 评判能力：pairwise accuracy | SFT 基线 65.1% | M1 78.7%；M2 80.4%；M3 81.7% | （Tab. 4） |
| 评判能力：Spearman 相关 | SFT 基线 0.253 | M1 0.279；M2 0.331；M3 0.349 | （Tab. 4） |
| 评判提示的写法，SFT 基线 | Li et al. 的分档提示 26.6% | 加分式提示 65.1% | （§3.2.2¶4） |
| 回答平均长度 | M1 1092 | M2 1552；M3 2552 | （§3.2.1¶7） |
| 人工评测，50 条指令，作者盲评 | SFT 基线 | 越往后的迭代优势越大，与 GPT-4 的判断一致 | （§3.2.1¶8，Fig. 5） |

## 局限与疑点

### 作者承认的

- 结果是初步的，安全评测和迭代训练的极限都还没研究（§6¶1）；只在一种设置下跑了三轮，更多轮次、不同能力的模型上的规律未知（§6¶2）。
- 回答变长，而长度与估计质量相关；reward hacking 是否会发生、什么条件下发生还不清楚；训练奖励和部分评测都用 LLM，需要更深入的分析（§6¶3）。
- 数学、逻辑推理类任务没有提升（§3.2.1¶6）；MT-Bench 的数学、代码和推理类提升较小，作者归因于 Open Assistant 种子指令偏少推理任务（§3.2.1¶9）。
- NLP 基准大体持平甚至可能下降，作者归因于训练指令与这些任务关系不大，并引用 InstructGPT 的"alignment tax"（§3.2.1¶10）。
- 作者认为这种改进在现实设置中很可能会饱和（§1¶4、§5¶1）。

### 本库判断的

- M3 对 SFT 基线 62.5% 对 9.8% 的胜率（§3.2.1¶4）和 AlpacaEval 的提升（Tab. 1）都由 GPT-4 判定，同期回答长度涨到 2.3 倍（§3.2.1¶7），论文没有做按长度控制的对照，无法区分多少提升来自长度。
- 人工评测由作者本人盲评（§3.2.1¶8），没有独立评审者参与。
- 评判能力的起点来自人：EFT 数据只保留与人工排序一致的评分（§3.1.1¶2），pairwise accuracy 最大的提升（65.1% 到 78.7%）发生在加入 EFT 时（§3.2.2¶2）；之后两轮自我训练各加 1.7 和 1.3 个点（§3.2.2¶3）。"摆脱人类偏好数据"的说法要打折扣。
- 评判能力只在 Open Assistant 的 541 条留出样本上测（§3.1.1¶2），与种子数据同分布；在训练中自己生成的新指令上评判是否同样准确，论文没有测。
- 主实验的新指令来自固定的 Llama 2-Chat 70B（§3.1.3¶2）；附录 A.5 检查了新模型自己能否生成指令，但没有用于主实验。
- venue 记为 ICML 2024：arXiv 的 comment 字段写着 ICML 2024，PMLR 论文集第 235 卷（Proceedings of the 41st International Conference on Machine Learning）收录了这篇论文，作者与 arXiv 一致。Kyunghyun Cho 署 NYU，Xian Li、Sainbayar Sukhbaatar、Jing Xu 署 Meta，其余三人同时署 Meta 和 NYU。

## 与其他工作的关系

- 与 [STaR](./202203-star.md)：两者都让模型为自己造训练数据。STaR 用标准答案决定留哪条推理（[STaR](./202203-star.md) §3.1¶1），Self-Rewarding 不需要标准答案，由模型自己打分（§2¶3），代价是评判会出错，而且出错的方向会进入下一轮训练。见[自我奖励](../concepts/self-rewarding.md#设计空间)。
- 与 RLAIF 和 Constitutional AI：作者说这类方法用 LLM 给反馈，但仍训练一个固定、独立的奖励模型（§4¶3）；Self-Rewarding 的区别是评判者就是被训练的模型本身。两者本库未收录。
- 与 [The AI Scientist](./202408-ai-scientist.md)：两篇都用 LLM 当评判者，也都拿人类判断校验评判者。Self-Rewarding 比对 Open Assistant 的人工排序（Tab. 4），The AI Scientist 比对 ICLR 2022 的录用决定（[The AI Scientist](./202408-ai-scientist.md) Tab. 1）。
