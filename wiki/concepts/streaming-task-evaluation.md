---
title: 连续任务流评测
type: concept
summary: 把前后依赖的任务按顺序连成一条流让 agent 边做边学，用来测持续学习能力
topics: [continual-learning]
aliases: [streaming task evaluation, task stream benchmark, sequential task evaluation, 边干边学评测, apprenticeship-style benchmark, 学徒式评测]
added: 2026-11-27
status: emerging
relations:
  - { topic: continual-learning, rel: part-of }
---

## 定义

来源：[十字路口 / 对话谷雨](../podcasts/20261108-crossing-gu-yu.md)

一类 benchmark 设计：任务不独立，按顺序一个接一个做，后面的任务要用到前面任务的反馈和学到的知识，得分反映 agent 在流中边做边学的能力。它要解决的问题是：普通 benchmark 的题目彼此独立，测不出部署后的 agent 能否在生产中持续迭代自己（[00:06:08]–[00:07:10]）。谷雨介绍的 NeoCognition [Apprentice Bench](../glossary.md#apprentice-bench) 是一个例子：100 道建筑行业会计报账题，每道涉及公司特有的规则，要 in a stream 连着做（[00:07:10]）。本库判断：这类设置在 Apprentice Bench 之前就有，例如 StreamBench: Towards Benchmarking Continuous Improvement of Language Agents（arXiv 2406.08747，2024-06）让 language agent 在输入流上根据反馈持续改进；NeoCognition 的做法是把它放到垂直行业的业务流程里。StreamBench 的素材待录入。

## 演化

## 设计空间

来源：[十字路口 / 对话谷雨](../podcasts/20261108-crossing-gu-yu.md)

| 做法 | 测什么 | 谷雨的看法 |
|---|---|---|
| 独立题目 | 单次任务能力 | 测不出持续学习（[00:07:10]） |
| 单个长任务（"一个人要做半天"） | 一次任务内的长程执行 | 这类任务难找，也难 scale up；他认为它不是长程的理想形态（[00:08:13]） |
| 连续任务流 | 跨任务边做边学 | 他认为真正的长程是一个员工从菜鸟变成老员工的几个月到一两年，scale up 后通向 lifelong intelligence（[00:08:13]–[00:09:14]） |

## 共识与分歧

来源：[十字路口 / 对话谷雨](../podcasts/20261108-crossing-gu-yu.md)

- 谷雨认为这类评测不容易刷分：数据不公开，厂商没法追着刷；它测的是持续学习这种 meta level 能力，只对着这家公司的规则把报账做好对模型没有意义（[00:12:15]）。
- 谷雨说第一版上最强的 Claude 模型约 80 分，新版本上最强模型的分数会低很多（[00:10:14]–[00:11:14]）。
- 本库判断：数据不公开让结果无法外部复核，"不易刷分"的代价是可信度只能依赖发布方；发布方 NeoCognition 做 continual learning，这个 benchmark 的设计与它的研究方向一致。截至 2026-11，本库只有这一个来源。

## 开放问题

- 流中前面做错的题会怎样影响后面的分数，评分是否区分"学到了"和"一开始就会"？
- 单一垂直场景（建筑行业会计）的结果能否推广到其他领域？
- 不公开数据的 benchmark，怎样让外部复核分数？
