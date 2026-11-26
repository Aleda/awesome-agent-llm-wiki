---
title: 自举推理
type: concept
summary: 模型为训练题自写推理过程，只留得出正确答案的来微调自己，再用新模型重新生成，循环提升推理能力
topics: [rsi]
aliases: [bootstrapping reasoning, bootstrapped reasoning, rationale bootstrapping, rationale generation bootstrapping, 自举推理数据]
added: 2026-11-27
status: established
relations:
  - { topic: rsi, rel: part-of }
---

## 定义

来源：[STaR](../papers/202203-star.md)

模型先按少量示例为训练集里的问题写出推理过程和答案，只保留答案正确的样本来微调自己，再用微调后的模型重新生成，如此循环（§1¶4、§3.1¶1）。它要解决的问题是：先写推理再答题能提高表现，但人工标注推理太贵、模板只在已知通解时可用（§1¶2），只用少量示例提示又不如在大数据上直接微调（§1¶3）。"自己生成"的是推理过程，决定留哪条的信号仍是每道题的标准答案（§3.1¶1）。

## 演化

## 设计空间

下表比较推理训练数据的几种来源，以及 STaR 的两个变体；最后一行是作为对照列出的另一个概念。

| 做法 | 推理从哪来 | 用什么判断留不留 | 代价与局限 |
|---|---|---|---|
| 人工或模板构造推理数据集 | 人写或模板生成（[STaR](../papers/202203-star.md) §1¶2） | 人工保证 | 人工贵；模板只在已知通解或有启发式规则时可用（[STaR](../papers/202203-star.md) §1¶2） |
| 少量示例提示，不微调 | 模型现场生成（[STaR](../papers/202203-star.md) §1¶3） | 不筛选 | 通常明显不如在大数据上直接微调答案（[STaR](../papers/202203-star.md) §1¶3） |
| 形式化数学中的专家迭代 | 模型采样证明 | 证明检查器加单独训练的价值函数 | 要求能直接验证证明、能大量采样，且从已在数学数据上微调的模型起步（[STaR](../papers/202203-star.md) §2¶2） |
| STaR，只做推理生成 | 模型按示例生成 | 最终答案是否等于标准答案（[STaR](../papers/202203-star.md) §3.1¶1） | 答错的题得不到训练信号，提升会停住（[STaR](../papers/202203-star.md) §3.2¶1） |
| STaR 加 rationalization | 答错的题给出正确答案，让模型反推推理，入库时去掉提示（[STaR](../papers/202203-star.md) §3.2¶1） | 同上 | 提示的构造方式并不总是显而易见（[STaR](../papers/202203-star.md) §5¶2）；GSM8K 上几乎没有额外收益（[STaR](../papers/202203-star.md) Tab. 2） |
| 多采样、提高温度 | 模型多次高温采样 | 同上 | 作者试过，推理错但答案对的样本变多，模型反而更差（[STaR](../papers/202203-star.md) §5¶3） |
| 对照：[自我奖励](self-rewarding.md) | 模型生成回答 | 模型自己当评判者打分，不需要标准答案（[Self-Rewarding](../papers/202401-self-rewarding-language-models.md) §2¶3） | 评判本身会出错，长度等偏差可能被放大（[Self-Rewarding](../papers/202401-self-rewarding-language-models.md) §6¶3） |

[ReAct](../papers/202210-react.md) 把同样的思路用在 agent 轨迹上：用 ReAct 生成的 3,000 条答对轨迹微调 PaLM-8B/62B，作者说做法类似 STaR（[ReAct](../papers/202210-react.md) §3.2¶4）。

## 共识与分歧

- STaR 作者认为 rationalization 加快并改进了自举（[STaR](../papers/202203-star.md) §1¶8），算术上它让多个位数同时学会（[STaR](../papers/202203-star.md) §4.3¶2）；但 GSM8K 上带与不带只差 10.7% 对 10.1%（[STaR](../papers/202203-star.md) Tab. 2），作者也说这一任务上没有明显提升（[STaR](../papers/202203-star.md) §4.5¶1）。它在什么任务上有用，作者自己列为待研究的问题（[STaR](../papers/202203-star.md) §5¶1）。
- 推理质量的证据比准确率弱：众包更偏好 STaR 的推理（[STaR](../papers/202203-star.md) §4.4¶5），甚至比人写的推理更受偏好，作者自己不认为这说明推理达到人类水平（[STaR](../papers/202203-star.md) §4.4¶6）；模型也常写出与题目相关但不构成论证的话（[STaR](../papers/202203-star.md) §4.4¶7）。
- 本库判断：这条路线的上限取决于有没有标准答案。STaR 能用的信号只是答案对错，随机猜中率高时信号失效（[STaR](../papers/202203-star.md) §6¶2）；[自我奖励](self-rewarding.md)去掉了对标准答案的依赖，换来的是评判者本身可能出错。这正是 [RSI](../topics/rsi.md#关键争论) 主题里"评测器瓶颈"的两端。

## 开放问题

- 只有问题、没有答案的数据上能否自举？STaR 作者提出用多次高温采样的多数票当答案（[STaR](../papers/202203-star.md) §5¶3），没有做实验。
- 随机猜中率高的任务上怎样过滤掉差的推理（[STaR](../papers/202203-star.md) §6¶2）？
- 自举需要底座模型的 few-shot 表现高于随机（[STaR](../papers/202203-star.md) §6¶2），这个门槛随模型规模怎样变化？
- STaR 与它所近似的强化学习目标之间的关系，作者认为值得进一步研究（[STaR](../papers/202203-star.md) §3.1¶2）。
