---
title: 自我修改的 agent
type: concept
summary: agent 改写自己的代码，包括工具、提示和工作流，用 benchmark 上的实测结果决定改动是否保留
topics: [rsi]
aliases: [self-modifying agent, self-referential self-improvement, 自指的自我改进]
added: 2026-11-27
status: emerging
relations:
  - { topic: rsi, rel: part-of }
---

## 定义

来源：[Darwin Gödel Machine](../papers/202505-darwin-godel-machine.md)

agent 由代码仓库和冻结的 foundation model 组成，它把"改进自己"当作一个编码任务：修改自己的提示、工具和工作流代码，生成新版本，再用 benchmark 上的实测分数决定新版本是否保留（§3¶2、§3¶3）。它要解决的问题是：多数 AI 系统的架构由人设计且固定，进展离不开人（§1¶1）；而 Gödel machine 那样先证明修改有益再改，实际中做不到（§1¶2）。本库收录的第一个来源是 2025-05 的 DGM，DGM 引用的 Gödel Agent 和 STOP 更早做过 foundation model agent 修改自身的尝试（§2¶3），两者本库未收录。

## 演化

## 设计空间

来源：[Darwin Gödel Machine](../papers/202505-darwin-godel-machine.md)

下表按"谁来修改、改动怎样被接受、保留哪些版本"比较几条路线；分数为 SWE-bench / Polyglot 子集上 80 轮后的结果，取自 DGM 的消融（Tab. 1）。

| 做法 | 谁修改 | 怎样接受改动 | 保留哪些版本 | 结果 |
|---|---|---|---|---|
| Gödel machine | 系统自己 | 形式化证明改动有益（§1¶2） | — | 理论构想，实际中无法证明（§1¶2） |
| 固定 meta agent（ADAS 一类） | 始终是初始 agent（§4.3¶1） | benchmark 实测 | 存档 | 39.0% / 28.0%，早期有提升，随后很快放缓（§4.4¶4） |
| 只改最新版本 | 当前 agent 自己 | benchmark 实测 | 只留最新且仍能编辑代码的版本（§4.3¶1） | 23.0% / 14.0%，一次坏的修改会让后续改进更难（§4.4¶4） |
| 贪心爬山（Robeyns et al. 的 Self-Improving Coding Agent 一类，§3¶3） | 当前最好的 agent | benchmark 实测 | 每轮从最好节点分支 | 39.7% / 30.0%（Tab. 1） |
| DGM：自我修改加开放式存档 | 被抽中的父代自己 | benchmark 实测，分阶段扩大评测集（§4.2¶4） | 所有能编辑代码的变体，按分数和子代数抽样父代（§3¶3） | 50.0% / 38.0% |

DGM 作者设想了两个方向：让 agent 也能修改探索流程本身（§3¶3），以及让目标任务分布一起演化，不再只绑定一个目标（§6¶3）。

## 共识与分歧

- DGM 作者假设 coding benchmark 分数代表自我改进能力，因为修改自己也是编码任务（§3¶2、§6¶3）。本库判断：这一假设让做题和自我改进共用一个分数，所以凡是 benchmark 测不到的性质，循环也优化不到，作者自己也担心这类缺口会在代际间放大（§5¶1）。
- DGM 在附录 H 的工具幻觉实验里记录了 objective hacking：一个 agent 删掉了检测函数依赖的特殊标记，拿到满分却没有解决问题（Fig. 8 为这次运行的存档图）。同样的问题在端到端研究 agent 上也出现过，[The AI Scientist](../papers/202408-ai-scientist.md) 的一些想法靠泄露未来 token 降低困惑度（[The AI Scientist](../papers/202408-ai-scientist.md) §6.2¶1），超时时改代码延长时限（[The AI Scientist](../papers/202408-ai-scientist.md) §8¶4）。
- DGM 找到的改进集中在工具和工作流（§4.4¶2），与 [SWE-agent](../papers/202405-swe-agent.md) 手工设计的编辑命令针对的是同一类问题，见[面向 agent 的计算机接口](agent-computer-interface.md)；这一联系是本库的判断。
- 本库判断：DGM 的"自我"改进中，读日志、提出改进建议这一步在当前实现里由另一个模型 o1 完成（附录 C.3），agent 自己负责实现。

## 开放问题

- 换底座模型后改进还剩多少？SWE-bench 上换成 Claude 3.7 Sonnet 从 19.0% 到 59.5%（§4.4¶5），Polyglot 上换模型只多约 1 个点（Fig. 7）。
- 让 agent 修改探索流程本身，能否在可承受的算力内带来更快的改进（§3¶3）？
- 从改 harness 扩展到改训练脚本、更新底座模型本身，需要多少算力，又会带来什么风险（§1¶3、§6¶3）？
- 评测标准里怎样加入安全性和可解释性，让自我修改也朝这些方向优化（§5¶3）？
