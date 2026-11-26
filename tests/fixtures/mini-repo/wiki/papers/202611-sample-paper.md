---
title: Sample Paper for Context Compaction
type: paper
summary: 演示论文：验证论文页 frontmatter、锚点与关系解析。
topics: [context]
aliases: []
added: 2026-11-26
date: 2026-11-03
url: https://arxiv.org/abs/2611.00001
source_dir: sources/papers/2611.00001
venue: arXiv
by:
  - { entity: demo-org, role: org }
relations:
  - { concept: context-compaction, rel: proposes }
  - { concept: old-name, rel: challenges, note: 挑战旧方案的假设 }
---

## 新认知

- **提出每 8 轮对话压缩一次上下文，可以在不损失准确率的前提下显著降低上下文长度（§3.2）**，细节见[上下文压缩](../concepts/context-compaction.md#定义)。
- 压缩策略相比不压缩的基线在更长上下文下准确率更稳定（Fig. 4）。

## 核心问题

现有做法在长对话下上下文线性增长，推理成本随之上升。

## 核心洞察

大部分历史轮次对后续决策的边际信息量很低，可以被摘要替代。

## 核心设计

1. 每 8 轮触发一次压缩，摘要替换被压缩的原始轮次。

## 效果

| 设置 | 基线 | 结果 | 锚点 |
|---|---|---|---|
| 压缩 vs 不压缩 | 不压缩 | 准确率持平，上下文减少 | （Fig. 4） |

## 局限与疑点

- 作者承认：压缩窗口固定为 8 轮，未必适合所有任务。

## 与其他工作的关系

参见术语表中的 [BrowseComp-Plus](../glossary.md#browsecomp-plus)。
