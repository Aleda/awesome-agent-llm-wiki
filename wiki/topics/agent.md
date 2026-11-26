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

本库所说的 agent，是由 LLM 驱动、在循环里反复决策的系统：每一步读取当前状态，决定调用哪个工具或输出什么，把结果写回状态，直到任务结束。它由四部分组成：模型、驱动循环的 harness、工具，以及跨步骤保留的状态。单次问答用不到后两者；任务一长、步骤一多，难点就集中到每一步看什么（context）、跨任务留什么（memory）、经验如何让 agent 变好（continual learning）。RSI 再往上一层，问 AI 能否改进产生它自己的研究流程。

## 概念地图

### 一次任务之内

- [Context](context.md)：模型在每一步能看到什么，信息超出窗口时如何压缩和取舍。
- agent 循环：[推理与行动交替](../concepts/interleaved-reasoning-acting.md)，模型在一条轨迹里交替写推理和执行动作，最早来源是 [ReAct](../papers/202210-react.md)。
- 工具调用的能力从哪里来：[自监督工具使用学习](../concepts/self-supervised-tool-learning.md)，模型自己标注哪里调用工具有用，再训练进权重，见 [Toolformer](../papers/202302-toolformer.md)。
- harness 设计：[面向 agent 的计算机接口](../concepts/agent-computer-interface.md)，按模型的能力设计它能用的命令和看到的反馈，见 [SWE-agent](../papers/202405-swe-agent.md)。

### 跨任务

- [Memory](memory.md)：任务结束后保存哪些信息，下次如何取回。
- [Continual Learning](continual-learning.md)：经验如何让 agent 在之后的任务上变好，经验存在权重里还是存在外部。

### 改进系统本身

- [RSI](rsi.md)：AI 系统能否实质性加速改进它自己的研究。

四个方向之间有共享的边界。context 和 memory 的分界在于信息当前是否在模型输入里；memory 和 continual learning 都涉及经验存放在哪里；RSI 可以看作把 continual learning 的问题放到研究流程这一层：被改进的对象从单个 agent 的行为变成产生下一代模型的过程。

## 关键争论

- harness 做多少、模型做多少：控制流、上下文取舍、何时调用工具，写成外部规则，还是交给模型自己决定。这个问题在 context 和 memory 两个方向里各有一个具体版本，见[模型自管理上下文](../concepts/model-managed-context.md#设计空间)。SWE-agent 站在 harness 一侧：模型固定，命令、反馈和历史整理都由接口决定，同一个 GPT-4 Turbo 在 SWE-bench Lite 上从直接用 shell 的 11.00% 提到 18.00%（[SWE-agent](../papers/202405-swe-agent.md) Tab. 1）；它把旧观察按固定规则折叠（[SWE-agent](../papers/202405-swe-agent.md) §3¶7），CLM 则把上下文编辑权整个交给模型（[CLM](../papers/202609-context-language-models.md) §4.1¶2）。两篇任务不同，没有直接对照。
- 能力放在哪里：推理时的循环、工具和提示词，与训练进权重，哪一类改进更能迁移到新任务。三篇早期工作各选一处：ReAct 用少量示例提示冻结的模型（[ReAct](../papers/202210-react.md) §2¶3），但也发现小模型要靠微调才学得会（[ReAct](../papers/202210-react.md) §3.3¶8）；Toolformer 把何时调用工具训练进权重，不改工具（[Toolformer](../papers/202302-toolformer.md) §2¶8）；SWE-agent 不改权重，只改接口（[SWE-agent](../papers/202405-swe-agent.md) §2¶4）。
- benchmark 分数能说明多少：同一个模型换 harness、工具或预算，分数差距可能很大，不同报告之间的数字往往不能直接比较。SWE-agent 的消融里，只改文件查看器一次显示的行数，解决率就在 12.7% 到 18.0% 之间变化（[SWE-agent](../papers/202405-swe-agent.md) Tab. 3）；Toolformer 的零样本结果用的是宽松口径，如 LAMA 只看前五个词里有没有答案（[Toolformer](../papers/202302-toolformer.md) §4.2.1¶1）。

## 最近进展
