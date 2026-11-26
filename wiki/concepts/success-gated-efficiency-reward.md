---
title: 成功门控的效率奖励
type: concept
summary: RL 中只在成功轨迹之间按推理成本给效率奖励，避免模型为省算力牺牲正确性
topics: [context]
aliases: [success-gated efficiency advantage, success-gated efficiency reward, 成功门控效率优势]
added: 2026-11-27
status: emerging
relations:
  - { topic: context, rel: part-of }
  - { concept: model-managed-context, rel: part-of }
---

## 定义

来源：[Context Language Models](../papers/202609-context-language-models.md)

在强化学习里，效率奖励只在同组的成功轨迹之间比较，成本越低优势越高；失败轨迹拿不到效率分，组内成功轨迹少于两条时不给效率信号（§4.2¶6）。它解决的问题是：只用结果奖励时，成功轨迹里的低效编辑和失败轨迹里的有用编辑都得不到区分（§4.2¶6），而直接奖励"编辑次数"或"删掉多少上下文"会让模型乱删重要信息来投机。

## 演化

## 设计空间

来源：[Context Language Models](../papers/202609-context-language-models.md)

| 奖励设计 | 能否区分编辑好坏 | 投机风险 | 代表 |
|---|---|---|---|
| 只用结果奖励 | 弱，整条轨迹共享一个结果（§4.2¶6） | 低 | 标准 GRPO |
| 奖励编辑频率或删除量 | 能，但信号与目标错位 | 高：删掉重要信息、破坏前缀复用（§4.2¶6） | CLM 论文讨论后放弃 |
| 成功门控，按 prefix-reuse FLOPs 排序 | 只在成功轨迹之间区分成本（§4.2¶6） | 低：失败轨迹没有效率分 | CLM（Tab. 2） |

## 共识与分歧

来源：[Context Language Models](../papers/202609-context-language-models.md)

- 目前只有 CLM 一份素材。作者报告加上效率奖励后，CLM 和摘要 harness 的推理成本都下降，准确率没有明显损失（Fig. 29）。
- 成本用 [prefix-reuse FLOPs](../glossary.md#prefix-reuse-flops) 而不是上下文长度计（§4.1¶5），因为改写上下文本身会引发重算，上下文更短不等于更便宜。

## 开放问题

来源：[Context Language Models](../papers/202609-context-language-models.md)

- 效率权重怎么定？CLM 只报告了一个 9B 模型、一类深度研究任务上的结果（Tab. 2）。
- 组内成功轨迹太少时没有效率信号（§4.2¶6），在成功率低的难任务上这个奖励是否基本失效？
