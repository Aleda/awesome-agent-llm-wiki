---
title: 自我奖励
type: concept
summary: 被训练的模型同时充当自己的奖励模型，用 LLM-as-a-Judge 给自己的回答打分，再用这些偏好数据训练自己
topics: [rsi]
aliases: [self-rewarding, self-rewarding training, self-reward, model-as-own-judge, 自奖励]
added: 2026-11-27
status: emerging
relations:
  - { topic: rsi, rel: part-of }
  - { concept: bootstrapped-reasoning, rel: alternative-to, note: 两者都让模型为自己生成训练数据；自举推理用标准答案决定留哪条推理，自我奖励不需要标准答案，由模型自己打分 }
---

## 定义

来源：[Self-Rewarding Language Models](../papers/202401-self-rewarding-language-models.md)

同一个模型既生成回答，又通过 LLM-as-a-Judge 提示给自己的回答打分，用这些分数构造偏好数据来训练自己，逐轮迭代；奖励模型因此不再冻结，评判能力也随训练变化（§1¶3、§2¶4）。它要解决的问题是：RLHF 和 DPO 都受人类偏好数据的规模和质量限制，RLHF 还受冻结奖励模型的质量限制（§1¶1）。

## 演化

## 设计空间

来源：[Self-Rewarding Language Models](../papers/202401-self-rewarding-language-models.md)

下表按"奖励信号从哪来、评判者是否随训练改变"比较几条路线，前四行取自 Self-Rewarding 论文的相关工作。

| 做法 | 奖励信号从哪来 | 评判者是否随训练改变 | 作者的评价 |
|---|---|---|---|
| RLHF | 从人类偏好训练的奖励模型 | 否，奖励模型冻结（§1¶1） | 受人类数据和冻结奖励模型的质量限制（§1¶1） |
| [DPO](../glossary.md#dpo) | 直接用人类偏好，不训练奖励模型（§4¶2） | 无评判者 | 同样受人类偏好数据限制（§1¶1） |
| RLAIF / Constitutional AI | LLM 给反馈，再训练一个固定、独立的奖励模型（§4¶3） | 否 | 与 RLHF 效果大致相当（§4¶3） |
| Instruction Backtranslation | 从网页文档反推指令来扩充数据，由模型自己筛选（§4¶4） | 原文未说明 | 作者视为特定设置下的自我奖励（§4¶4） |
| 自我奖励 + Iterative DPO | 被训练的模型用加分式提示给自己的 4 个候选打分，最高和最低分组成偏好对（§2.3¶3、§3.1.3¶2） | 是，评判与指令跟随一起训练（§2¶4） | pairwise accuracy 从 78.7% 升到 81.7%（Tab. 4） |
| 只用自评高分样本做监督微调 | 同上，但只保留高分回答 | 是 | 没有帮助，偏好对才有帮助（§4¶4） |

评判提示的写法影响很大：同一个 SFT 基线，加分式提示 pairwise accuracy 65.1%，分档式提示 26.6%（§3.2.2¶4）。与[自举推理](bootstrapped-reasoning.md)相比，自我奖励不需要标准答案，代价是没有任何外部信号纠正评判者的错误。

## 共识与分歧

- Self-Rewarding 作者认为评判能力会随指令跟随能力一起变好，因为评判也是一种指令跟随任务（§3.2.2¶3）。本库判断：评判能力最大的一步来自由人工排序筛出的评判种子数据（§3.2.2¶2、§3.1.1¶2），之后两轮自我训练各加 1.7 和 1.3 个点（Tab. 4），而且只在与种子数据同分布的 541 条留出样本上测过（§3.1.1¶2）。
- 作者认为这种改进在现实设置中很可能饱和（§1¶4、§5¶1），并说数学和逻辑推理类任务上没有提升，现有训练主要让模型更好地使用已有知识（§3.2.1¶6）。
- 本库判断：论文里的循环并不全由模型自己完成，新指令来自固定的 Llama 2-Chat 70B（§3.1.3¶2），选 checkpoint 用 Claude 2（§3.1.3¶1），最终评测用 GPT-4（§3.1.2¶2）。
- 两份用 LLM 当评判者的素材都先拿人类判断校验评判者：Self-Rewarding 比对 Open Assistant 的人工排序（Tab. 4），The AI Scientist 比对 ICLR 2022 的录用决定，balanced accuracy 0.65 对人类基线 0.66（[The AI Scientist](../papers/202408-ai-scientist.md) Tab. 1）。区别在用途：前者的评判结果直接变成训练数据，后者只用来打分和筛选。

## 开放问题

- 回答长度从 1092 涨到 2552（§3.2.1¶7），而长度与估计质量相关；自我奖励的提升中有多少来自长度，会不会出现 reward hacking（§6¶3）？
- 迭代超过三轮、换成能力不同的模型时，改进的规律是什么（§6¶2）？
- 训练奖励和评测都用 LLM 时，怎样排除两者共有的偏好（§6¶3）？
- 能否用同样的评判流程专门评估安全性，让安全性也随迭代改进（§6¶4）？
