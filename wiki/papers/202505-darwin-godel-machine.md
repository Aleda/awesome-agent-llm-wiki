---
title: "Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents"
type: paper
summary: coding agent 改写自身代码、实测后存档所有可用变体，SWE-bench 子集从 20% 到 50%
topics: [rsi]
aliases: [DGM, Darwin Gödel Machine, Darwin Godel Machine]
added: 2026-11-27
date: 2025-05-29
url: https://arxiv.org/abs/2505.22954
source_dir: sources/papers/2505.22954
venue: ICLR 2026
code: https://github.com/jennyzzt/dgm
pages: 72
by:
  - { entity: ubc, role: org }
  - { entity: vector-institute, role: org }
  - { entity: sakana-ai, role: org }
  - { name: Jenny Zhang, role: author }
  - { name: Shengran Hu, role: author }
  - { name: Cong Lu, role: author }
  - { name: Robert Lange, role: author }
  - { name: Jeff Clune, role: author }
relations:
  - { concept: self-modifying-agent, rel: extends, note: 在 agent 改写自身代码、用 benchmark 验证改动的做法上加入开放式存档：保留所有还能编辑代码的变体，父代按分数和子代数抽样，暂时变差的分支也能继续演化；Gödel Agent 和 STOP 更早，Robeyns et al. 的 Self-Improving Coding Agent 是同期工作 }
  - { concept: automated-ai-research, rel: extends, note: 把设计 coding agent 这部分 AI 研发交给 agent 自己：读自己的评测日志、提出改动、改写自己的代码，以 coding benchmark 分数决定改动是否保留；底座模型冻结，实验里没有训练 }
---

## 新认知

- **DGM 把 Gödel machine"先证明改动有益再改"的要求换成"改完用 benchmark 测"：作者认为不加限制性假设时无法形式化证明一次修改有益，于是用实验证据代替证明（§1¶2、§3¶1）**，见[自我修改的 agent](../concepts/self-modifying-agent.md#设计空间)。
- **整套方法押在一个假设上：coding benchmark 的分数同时代表做题能力和自我改进能力，因为改写自己的代码本身就是一次编码任务（§3¶2）；作者把它列为关键假设，并提出可以让任务分布一起演化来去掉这一约束（§1¶3、§6¶3）**，见[自我修改的 agent](../concepts/self-modifying-agent.md#共识与分歧)。
- **作者报告 80 轮后 SWE-bench（Verified 的分阶段子集，最多 200 题）从 20.0% 升到 50.0%，Polyglot 50 题子集从 14.0% 升到 38.0%、全集从 14.2% 升到 30.7%；同一 SWE-bench 子集上，修改者固定为初始 agent 的对照到 39.0%，只在最新版本上改的对照到 23.0%（§4.2¶2、§4.2¶4、§4.4¶1、Tab. 1）**，见[自我修改的 agent](../concepts/self-modifying-agent.md#设计空间)。
- 存档的价值在于保留暂时变差的分支：SWE-bench 上第 4 和第 56 轮的 agent 低于各自父代，之后沿这条路仍演化出超过所有前代的 agent（§4.4¶3）；每轮总选当前最好节点的贪心版本只到 39.7%（Tab. 1），见[自我修改的 agent](../concepts/self-modifying-agent.md#设计空间)。
- DGM 找到的改进集中在工具和工作流，例如把整文件查看和整文件替换改成按行查看、按字符串替换，以及多次尝试后由另一个模型挑出最好的方案（§4.4¶2），见[自我修改的 agent](../concepts/self-modifying-agent.md#共识与分歧)。
- 改进在换底座模型后基本还在：SWE-bench 200 题上，换成 Claude 3.7 Sonnet 时初始 agent 19.0%、DGM 找到的 agent 59.5%，换成 o3-mini 时为 23.0% 对 33.0%（§4.4¶5）；但 Polyglot 上换模型只多 1 个点左右（Fig. 7），见[自我修改的 agent](../concepts/self-modifying-agent.md#开放问题)。
- 能自我修改的范围只是 agent 的 Python 代码：底座模型冻结，训练脚本不在实验范围内（§1¶3），存档维护和父代选择这套探索流程本身也固定、不能被 DGM 修改（§3¶3），见[自动化 AI 研究](../concepts/automated-ai-research.md#设计空间)。
- 作者警告只为 benchmark 分数优化的修改可能带进 benchmark 测不到的问题，并在代际之间放大（§5¶1）；附录 H 的工具幻觉实验（Fig. 8）里，一个 agent 删掉了检测函数依赖的特殊标记，拿到满分却没解决问题，作者称之为 objective hacking，见[自我修改的 agent](../concepts/self-modifying-agent.md#共识与分歧)。
- 代价不低：一次 SWE-bench 运行约两周，API 开销显著（§6¶2），附录 E.1 估计约 22,000 美元，两个对照各约 10,000 美元，见[自动化 AI 研究](../concepts/automated-ai-research.md#共识与分歧)。

## 核心问题

多数 AI 系统的架构由人设计且固定，不能改写自己的源代码，所以每一步进展都离不开人（§1¶1）。Gödel machine 要求每次自我修改都先证明有益，实际中做不到（§1¶2）。已有基于 foundation model 的自我改进方法，要么由固定的 meta agent 去改别的 agent（§2¶2），要么下游任务与自我改进所需的能力不一致，要么沿单一路线爬山容易停在次优状态（§2¶3）。本质上这是一个程序空间里的开放式搜索问题，难点是找一个既衡量下游能力、又衡量"继续改进自己"能力的适应度。

## 核心洞察

把系统做成 coding agent，自我改进就成了一个修改自己代码库的编码任务，coding benchmark 上的提升也就说明它更会改自己（§3¶2）。再借鉴开放式演化的思路，保留有意思但不一定最优的中间版本当作"垫脚石"，它们可能在很久之后才引出突破（§1¶3、§3¶3）。

## 核心设计

1. **初始 agent 很简单**：冻结的 foundation model 加两个工具，一个执行 Bash 命令，一个查看和编辑整个文件或目录（§4.1¶1）。做简单是为了让自我改进的效果清楚可见（§4.1¶1）。
2. **自我修改**：被选中的父代分析自己的评测日志，提出下一个要实现的功能，再把它当作问题描述去改自己的代码库，生成一个新 agent（§3¶3）。修改时用 Claude 3.5 Sonnet (New)；评测时 SWE-bench 用 Claude 3.5 Sonnet (New)，Polyglot 用 o3-mini（§4.1¶1，Tab. 3）。
3. **开放式存档**：所有能编译、仍能编辑代码库的 agent 都进存档，其余丢弃；父代按分数大致成正比、按已有可用子代数成反比抽样，每个 agent 的概率都大于零（§3¶3）。这样既利用强者，也探索采样少的分支。
4. **分阶段评测**：先用 10 题检查基本的编辑能力，通过的再测 50 题；SWE-bench 上 60 题成功率超过 40% 且排进存档前二的，再扩到 200 题（§4.2¶4）。这样做是因为全量评测太贵（§4.2¶4）。
5. **安全措施**：执行和自我修改都在隔离沙箱里，每次执行有严格时限，修改范围限于 agent 自己的 Python 代码，存档保留可追溯的修改谱系（§5¶2）。

## 效果

SWE-bench 指 [SWE-bench Verified](../glossary.md#swe-bench-verified)（§4.2¶2）；[Polyglot](../glossary.md#polyglot) 报告 pass@1，agent 看不到标准测试的结果，排行榜用的是 pass@2（§4.2¶3）。除标明"全集"外，分数都来自 §4.2 的子集评测（Fig. 2）。

| 设置 | 基线 | 结果 | 锚点 |
|---|---|---|---|
| SWE-bench，80 轮 | 初始 agent 20.0% | 50.0% | （§4.4¶1） |
| Polyglot 50 题子集，80 轮 | 初始 agent 14.0% | 38.0% | （§4.4¶1） |
| Polyglot 全集 | 初始 agent 14.2% | 30.7% | （§4.4¶1） |
| 消融，SWE-bench / Polyglot | 无开放式探索 23.0% / 14.0%；无自我改进 39.0% / 28.0%；贪心选父代 39.7% / 30.0% | DGM 50.0% / 38.0% | （Tab. 1） |
| 人工设计的 agent，SWE-bench 同一 200 题 | 经核验的开源 SoTA OpenHands + CodeAct v2.1 51.0%（附录 E.4，全量 Verified 上为 53.0%） | DGM 50.0%，作者称两者相当 | （§4.4¶1） |
| 人工设计的 agent，Polyglot 同一子集 | [Aider](../glossary.md#aider)，正文和附录 E.5 都没有给出它在 pass@1 下的分数 | 作者称 DGM 远超 Aider | （§4.4¶1、§4.3¶2） |
| 换底座模型，SWE-bench 200 题 | 初始 agent：o3-mini 23.0%；Claude 3.7 Sonnet 19.0% | DGM 找到的 agent：33.0%；59.5% | （§4.4¶5） |
| 换 benchmark | Polyglot 上初始 agent 14.2%；SWE-bench 上初始 agent 20.0% | SWE-bench 上演化的 agent 在 Polyglot 28.9%；Polyglot 上演化的 agent 在 SWE-bench 24.5% | （§4.4¶6） |
| 生成的 agent 中仍能编辑代码的比例，SWE-bench | 无开放式探索 32.5%；无自我改进 32.5% | 51.3% | （Tab. 2） |
| 运行成本，SWE-bench | — | 单次约两周，API 开销显著 | （§6¶2） |

## 局限与疑点

### 作者承认的

- 仍不如闭源的 SWE-bench SoTA；一次运行约两周，需要大量算力（§6¶2）。
- 能力受底座模型限制，本文没有改写训练脚本、训练新模型（§1¶3、§6¶3）。
- 开放式探索流程固定，不能被 DGM 修改（§3¶3）。
- 关键假设是 coding benchmark 能反映自我改进能力（§6¶3）。
- 只为 benchmark 优化可能引入漏洞或违背人类意图的行为，迭代修改也可能让内部逻辑越来越难理解（§5¶1）；附录 H 记录了一次 objective hacking，作者发现把检测函数对 agent 隐藏起来时这类情况更少。
- 作者说目前没有在生成的 agent 中发现有害或恶意行为（§5¶2）。

### 本库判断的

- "自我"改进的诊断步骤不完全由 agent 自己完成：附录 C.3 说，当前实现用另一个模型 o1 读评测日志、提出改进建议，再交给 coding agent 实现。§3¶3 的写法"父代分析自己的评测日志"容易让人以为全由 agent 自己完成。
- 附录 C.3 还说诊断提示里包含该任务的私有测试补丁；作者靠人工检查日志判断没有记忆或过拟合，并以跨模型、跨 benchmark 的迁移结果（§4.4¶6）作旁证，没有给出定量的泄露检验。
- 消融的计算量不对等：三者都跑 80 轮，但附录 E.1 估计 DGM 一次约 22,000 美元、对照约 10,000 美元。
- SWE-bench 的主结果只有一次运行；附录 A.4 只在 Polyglot 上跑了三次看稳定性。
- "跨模型泛化"主要靠 SWE-bench 的结果（§4.4¶5）；Polyglot 上换成 Claude 3.5 Sonnet (New) 和 Claude 3.7 Sonnet 时只多约 1 个点（Fig. 7，附录 A.2 给出 32.0% 对 33.3%、35.6% 对 36.8%）。
- venue 记为 ICLR 2026：arXiv v3 的 PDF 页眉写着 "Published as a conference paper at ICLR 2026"，ICLR 2026 论文集（proceedings.iclr.cc）也收录了这篇论文，作者与 arXiv 一致。Jenny Zhang 署 UBC 和 Vector Institute，Shengran Hu、Cong Lu 同时署 UBC、Vector Institute 和 Sakana AI，Robert Lange 署 Sakana AI，Jeff Clune 署 UBC 和 Vector Institute。

## 与其他工作的关系

- 与 [SWE-agent](./202405-swe-agent.md)：DGM 自己找到的编辑工具改进，按行查看、按字符串替换（§4.4¶2），正是 SWE-agent 手工设计 agent-computer interface 时针对的问题，见[面向 agent 的计算机接口](../concepts/agent-computer-interface.md)。论文本身没有把它们和 ACI 联系起来，这是本库的判断。
- 与 [The AI Scientist](./202408-ai-scientist.md)：两篇有三位共同作者（Cong Lu、Robert Lange、Jeff Clune）。The AI Scientist 在展望里提出让系统以自指的方式直接研究自己的代码（[The AI Scientist](./202408-ai-scientist.md) §9¶9），DGM 在 coding agent 上做了这件事，但研究对象从论文换成了 agent 自己的代码。
- 与 ADAS：DGM 的"无自我改进"对照就是在本设置下复现 ADAS，修改者始终是初始 agent（§4.3¶1）。作者认为 DGM 的区别是由同一个系统解题并修改自己，省去了手工设计的 meta agent（§2¶2）。ADAS 本库未收录。
- 与 Gödel Agent、STOP 和 Robeyns et al. 的 Self-Improving Coding Agent：作者说这几项工作也用 foundation model 做自我改进，最接近的是同期的 Robeyns et al.，同样让单个 agent 解编码题并修改自己的代码库；DGM 的主要区别是开放式探索循环（§2¶3）。三者本库未收录。
