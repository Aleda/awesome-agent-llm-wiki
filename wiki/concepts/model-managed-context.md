---
title: 模型自管理上下文
type: concept
summary: 由正在执行任务的模型决定上下文里保留、改写和删除什么，而不是交给外部固定规则
topics: [context]
aliases: [model-managed context, model-controlled context, context as a file, 上下文即文件]
added: 2026-11-27
status: emerging
relations:
  - { topic: context, rel: part-of }
---

## 定义

来源：[Context Language Models](../papers/202609-context-language-models.md)

让正在执行任务的模型自己决定当前上下文保留什么、改写什么、删掉什么。它要解决的问题是：外部固定规则（到长度阈值就摘要、截断）不知道后续步骤需要哪些细节，在需要逐字保留或局部更新的任务上会丢信息或留下冗余（§3¶3）。

## 演化

## 设计空间

来源：[Context Language Models](../papers/202609-context-language-models.md)

"谁决定上下文怎么变"有几条路线。下表的分类和代表工作按 CLM 论文的相关工作整理，频繁压缩一行待后续素材补充。

| 路线 | 谁决定何时改 | 谁决定怎么改 | 代表 | 代价与疑点 |
|---|---|---|---|---|
| harness 固定规则 | harness（长度阈值或每轮） | harness 预设的摘要流程 | Codex、Cursor 的摘要压缩，MEM1（§2¶1） | 不了解任务，摘要会丢失或编造细节（§3¶3） |
| 频繁压缩 | （待录入） | （待录入） | （待录入） | （待录入） |
| 模型在预定义动作里选 | 模型 | 工具预设：压缩、卸载、检索、分支 | Self-Compact、AutoCompact、ACM、Sculptor（§2¶1） | 动作空间由人设计，自主度受限（§2¶1） |
| 上下文作为外部变量 | 模型决定读入什么 | 实时上下文仍只追加 | RLM（§2¶2） | 不处理实时上下文本身的增长（§2¶2） |
| 上下文即文件，模型任意改写 | 模型 | 模型自己写 Bash 或脚本 | CLM（§4.1¶3） | 中段编辑使前缀缓存失效（§4.1¶6）；依赖模型能力（§5.2¶4）；新的注入面（§6¶1） |

## 共识与分歧

来源：[Context Language Models](../papers/202609-context-language-models.md)

- 目前本库只有一份素材支撑。CLM 作者认为放开动作空间后，模型能找到比人工策略更好的管理方式，并把这看作 The Bitter Lesson 的又一例（§1¶1）。
- 分歧在"值不值得交给模型"：作者自己的数据显示，小模型在训练前用这种方式反而不如摘要 harness（§5.2¶4），但在另一组设置下又略高（Fig. 19）。context 主题页里"长上下文还是频繁压缩"和"模型自管理还是 harness 管理"两场争论都与此有关，待更多素材进来再比较。

## 开放问题

来源：[Context Language Models](../papers/202609-context-language-models.md)

- 多大的模型才能可靠地管理自己的上下文？能力不足时是先用 RL 训练（§5.2¶4），还是退回 harness 规则？
- 可编辑上下文让注入或模型自生成的指令可以跨轮次留存（§6¶1），完整性该由谁来校验？
- 模型估不准自己已用的上下文长度（Fig. 30），这一能力应该靠训练获得，还是由环境持续提供计数？
- harness 里的管理流程能否蒸馏成模型行为，最终进入权重（§6¶2）？
