---
title: 索引
type: raw
---

本页按层级列出 wiki 下已建的页面，新增或修改页面时同步更新本页。

## 主题

- [Agent](topics/agent.md) — LLM 在循环中调用工具、维护状态来完成任务的系统，本库的根节点
- [Context](topics/context.md) — agent 每一步能看到什么：上下文的组织、压缩与取舍
- [Memory](topics/memory.md) — 跨会话、跨任务保存和取回信息：存什么、怎么组织、何时读写
- [RSI](topics/rsi.md) — AI 系统能否实质性加速改进自身的研究，以及这种闭环的边界
- [Continual Learning](topics/continual-learning.md) — agent 在部署后从经验中持续变好，同时不丢掉已有能力

## 概念

- [模型自管理上下文](concepts/model-managed-context.md) — 由正在执行任务的模型决定上下文里保留、改写和删除什么，而不是交给外部固定规则
- [后缀缓存复用](concepts/suffix-cache-reuse.md) — 上下文中段被编辑后，复用未改动后缀的旧 KV cache，只重新计算新插入的部分
- [成功门控的效率奖励](concepts/success-gated-efficiency-reward.md) — RL 中只在成功轨迹之间按推理成本给效率奖励，避免模型为省算力牺牲正确性

## 论文

- [Context Language Models](papers/202609-context-language-models.md) — 把实时上下文镜像成文件，让模型用 Bash 自由编辑，长程任务上更准也更省算力

## Blog

（待录入）

## 视频

- [CLM 讲解（Agent智能体深度研究院）](videos/20261125-agent-deep-research-clm.md) — B 站对 CLM 论文的 13 分钟中文讲解，补充了分层组合与落地风险的看法

## 播客

（待录入）

## 实体

- [Meta](entities/meta.md) — 美国科技公司，本页同时收录其 Meta Superintelligence Labs 参与的素材
- [University of Washington](entities/uw.md) — 美国华盛顿大学，位于西雅图的公立研究型大学
