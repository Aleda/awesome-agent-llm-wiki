---
title: Agent
type: topic
summary: LLM 在循环中调用工具、维护状态来完成任务的系统，本库的根节点
aliases: [智能体, LLM agent]
added: 2026-11-26
root: true
order: 0
---

## 这个方向在解决什么

本库所说的 agent，是由 LLM 驱动、在循环里反复决策的系统：每一步读取当前状态，决定调用哪个工具或输出什么，把结果写回状态，直到任务结束。它由四部分组成：模型、驱动循环的 harness、工具，以及跨步骤保留的状态。单次问答用不到后两者；任务一长、步骤一多，难点就集中到状态如何组织、如何保留、如何让系统越用越好。本库的四个方向分别处理其中一个层面。

## 概念地图

### 一次任务之内

- [Context](context.md)：模型在每一步能看到什么，信息超出窗口时如何压缩和取舍。
- agent 循环：推理与行动交替（ReAct 一类）、工具调用（Toolformer 一类）。
- harness 设计：agent 与环境交互的接口，如 SWE-agent 的 agent-computer interface。

### 跨任务

- [Memory](memory.md)：任务结束后保存哪些信息，下次如何取回。
- [Continual Learning](continual-learning.md)：经验如何让 agent 在之后的任务上变好，经验存在权重里还是存在外部。

### 改进系统本身

- [RSI](rsi.md)：AI 系统能否实质性加速改进它自己的研究。

四个方向之间有共享的边界。context 和 memory 的分界在于信息当前是否在模型输入里；memory 和 continual learning 都涉及经验存放在哪里；RSI 可以看作把 continual learning 的问题放到研究流程这一层：被改进的对象从单个 agent 的行为变成产生下一代模型的过程。

## 关键争论

- harness 做多少、模型做多少：控制流、上下文取舍、何时调用工具，写成外部规则，还是交给模型自己决定。这个问题在 context 和 memory 两个方向里各有一个具体版本。
- 能力放在哪里：推理时的循环、工具和提示词，与训练进权重，哪一类改进更能迁移到新任务。
- benchmark 分数能说明多少：同一个模型换 harness、工具或预算，分数差距可能很大，不同报告之间的数字往往不能直接比较。

## 最近进展
