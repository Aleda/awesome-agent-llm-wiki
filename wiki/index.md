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

- [模型自管理上下文](concepts/model-managed-context.md) — 由执行任务的模型自己决定上下文保留、改写和删除什么，取代外部固定规则
- [后缀缓存复用](concepts/suffix-cache-reuse.md) — 上下文中段被编辑后，复用未改动后缀的旧 KV cache，只重新计算新插入的部分
- [成功门控的效率奖励](concepts/success-gated-efficiency-reward.md) — RL 中只在成功轨迹之间按推理成本给效率奖励，避免模型为省算力牺牲正确性
- [频繁上下文压缩](concepts/frequent-context-compaction.md) — 压缩阈值设得远低于 context window，甚至每个动作后压缩一次，让 agent 始终在短上下文里工作
- [语义状态空间模型](concepts/semantic-state-space-model.md) — 后训练模型每轮读写一段自然语言状态并只做一个动作，以此取代累积完整对话历史
- [自动化 AI 研究](concepts/automated-ai-research.md) — 把 AI 研发的执行、设计和选题逐级交给 AI，直到 AI 能端到端研发自己的后继者
- [AI 研发加速度量](concepts/ai-rd-uplift-measurement.md) — 用外部基准、内部产出和受控研究任务，衡量 AI 把 AI 研发本身加快了多少
- [AI 研发中的人类瓶颈](concepts/human-bottleneck-in-ai-rd.md) — 执行环节交给 AI 后，人工审查和定研究方向成为限制整体研发速度的环节
- [可验证的协调放缓](concepts/verifiable-coordinated-slowdown.md) — 多家前沿实验室在能相互核实的前提下，按相同条件同时放缓或暂停前沿 AI 开发
- [记忆笔记](concepts/memory-notes.md) — 模型把跨任务学到的规则和教训写成笔记并反复改写，让后续任务做得更好
- [连续任务流评测](concepts/streaming-task-evaluation.md) — 把前后依赖的任务按顺序连成一条流让 agent 边做边学，用来测持续学习能力

## 论文

- [Context Language Models](papers/202609-context-language-models.md) — 把实时上下文镜像成文件，让模型用 Bash 自由编辑，长程任务上更准也更省算力
- [You don't need long context](papers/202611-you-dont-need-long-context.md) — 频繁压缩加按需读取，把上下文压到 16K–48K，长程和长输入任务基本不掉点

## Blog

- [When AI builds itself（Anthropic）](blogs/20260918-anthropic-when-ai-builds-itself.md) — Anthropic 用内部数据论证 AI 已在加速 AI 研发，并主张建立可验证的协调放缓机制

## 视频

- [CLM 讲解（Agent智能体深度研究院）](videos/20261125-agent-deep-research-clm.md) — B 站对 CLM 论文的 13 分钟中文讲解，补充了分层组合与落地风险的看法

## 播客

- [对话谷雨（十字路口 Crossing）](podcasts/20261108-crossing-gu-yu.md) — NeoCognition 联创谷雨复盘 2026：RSI 是 NeoLab 的机会，记忆笔记式持续学习的上限被低估

## 实体

- [Anthropic](entities/anthropic.md) — 美国 AI 公司，开发 Claude 系列模型，本页同时收录 The Anthropic Institute 的素材
- [Jack Clark](entities/jack-clark.md) — Anthropic 联合创始人，长期负责政策工作，撰写 AI 周报 Import AI
- [Meta](entities/meta.md) — 美国科技公司，本页同时收录其 Meta Superintelligence Labs 参与的素材
- [NVIDIA](entities/nvidia.md) — 美国 GPU 和 AI 计算平台公司，本页同时收录 NVIDIA Research 参与的素材
- [University of Washington](entities/uw.md) — 美国华盛顿大学，位于西雅图的公立研究型大学
