---
title: 可验证的协调放缓
type: concept
summary: 多家前沿实验室在能相互核实的前提下，按相同条件同时放缓或暂停前沿 AI 开发
topics: [rsi]
aliases: [verifiable coordinated slowdown, coordinated slowdown, coordinated pause, verifiable pause, 协调放缓, 协调暂停]
added: 2026-11-27
status: emerging
relations:
  - { topic: rsi, rel: part-of }
---

## 定义

来源：[Anthropic / When AI builds itself](../blogs/20260918-anthropic-when-ai-builds-itself.md)

多个国家的多家前沿实验室按相同条件同时放缓或暂停前沿 AI 开发，并且每一方都能核实其他方确实停下了（§5¶3）。它要解决的问题是：放缓能给社会和对齐研究留出时间，但若只让最不谨慎的参与者追上来，所有人反而更不安全（§5¶1）。这一主张在 AI 治理讨论中早已有之，本库收录的第一个来源是 Anthropic 2026-09 的 blog。

## 演化

## 设计空间

来源：[Anthropic / When AI builds itself](../blogs/20260918-anthropic-when-ai-builds-itself.md)

| 做法 | 可行性 | 效果 |
|---|---|---|
| 不放缓 | 默认状态 | 没有全球协调机制时，各方在竞争和地缘压力下自行做安全决定（§5¶1） |
| 单个实验室单方面暂停 | 立即可做 | Anthropic 认为只会换掉领跑者，不产生更广泛的审议过程（§5¶4） |
| 可验证的协调放缓 | 需要尚不存在的核实系统 | Anthropic 认为能让社会结构和对齐研究跟上技术进展（§5¶2） |

一个可信的暂停还需要规定什么情况触发、什么情况解除、由谁裁决（§5¶3）。核实的难点在于训练比导弹发射井更容易隐藏，输入是通用物资，悄悄背叛的激励很大（§5¶3）。已有先例如《中导条约》的核查机制用了几十年才建起基础设施和信任（§5¶4）。

## 共识与分歧

来源：[Anthropic / When AI builds itself](../blogs/20260918-anthropic-when-ai-builds-itself.md)

- Anthropic 认为让世界拥有放缓或暂停的选项是好事，并表示有了核实系统、前沿附近的其他开发者也可核实地放缓时，它会放缓或暂停（§5¶2）。
- 本库判断：这一承诺以目前不存在的核实系统为前提，Anthropic 自己估计类似机制需要几十年（§5¶4），所以短期内不约束任何一方；同一篇文章也在展示 Anthropic 自身研发的加速（§0¶3）。
- 截至 2026-11，本库只有这一个来源，还没有收录反对或细化这一主张的素材。

## 开放问题

- 训练算力的哪些可观测量能作为核实对象，且难以伪造？
- 触发和解除条件由谁定、谁来裁决（§5¶3）？
- 原文说"detectability"是比"verifiability"更低的标准（§5¶3），只做到可检测时，协调能否成立？
