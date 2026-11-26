---
title: "Voyager: An Open-Ended Embodied Agent with Large Language Models"
type: paper
summary: Minecraft 里由 GPT-4 自定课程，把验证过的代码存进技能库并组合复用，不改权重持续学会新技能
topics: [continual-learning, agent]
aliases: [Voyager]
added: 2026-11-27
date: 2023-05-25
url: https://arxiv.org/abs/2305.16291
source_dir: sources/papers/2305.16291
venue: TMLR 2024
code: https://voyager.minedojo.org
pages: 42
by:
  - { entity: nvidia, role: org }
  - { entity: caltech, role: org }
  - { entity: ut-austin, role: org }
  - { entity: stanford, role: org }
  - { entity: uw-madison, role: org }
  - { name: Guanzhi Wang, role: author }
  - { name: Yuqi Xie, role: author }
  - { name: Yunfan Jiang, role: author }
  - { name: Ajay Mandlekar, role: author }
  - { name: Chaowei Xiao, role: author }
  - { name: Yuke Zhu, role: author }
  - { name: Linxi Fan, role: author }
  - { name: Anima Anandkumar, role: author }
relations:
  - { concept: skill-library, rel: proposes, note: 每个通过自我验证的任务程序作为一段可执行代码存入技能库，键是程序描述的 embedding，新任务按自生成的计划和环境反馈检索前 5 个技能，复杂技能由简单技能组合而成 }
  - { concept: verbal-reinforcement, rel: applies, note: 自我验证让另一个 GPT-4 判断任务是否完成，失败时写出改进建议，与环境反馈、执行错误一起进入同一任务的下一轮代码生成；作者认为它比 Reflexion 的自我反思更全面 }
  - { source: papers/202303-reflexion, rel: responds }
  - { source: papers/202210-react, rel: responds }
---

## 新认知

- **Voyager 把 agent 学会的行为存成可执行代码：每完成并验证一个任务，就把程序按描述的 embedding 存进技能库，遇到相似情境时检索出来，复杂技能由简单技能组合而成（§1¶4）**，本库把它记为[技能库](../concepts/skill-library.md)的最早来源。
- **技能库的作用主要在后期和迁移上：去掉技能库后探索在后期停滞（§3.4¶1），但在新世界的四个未见任务上，没有技能库的 Voyager 也有三个任务 3/3 解出，技能库让所需迭代从 36、30、27、26 降到 19、18、21、18（Tab. 2）**，见[技能库](../concepts/skill-library.md#共识与分歧)。
- 技能库可以交给别的方法用：AutoGPT 没有技能库时四个未见任务一个也解不出，拿到 Voyager 积累的技能库后能解出其中三个，只是成功率在 1/3 到 2/3 之间（Tab. 2、§3.3¶5），见[技能库](../concepts/skill-library.md#设计空间)。
- 没有可重试的具体任务，文字反思就无从下手：ReAct 和 Reflexion 面对"尽量多探索"这种抽象目标几乎没有进展（§3.3¶2），连木制工具都没解锁（Tab. 1），本库认为这说明[语言反馈强化](../concepts/verbal-reinforcement.md#共识与分歧)要先有课程或用户给出的具体任务。
- 自我验证是三种反馈里最重要的一种：去掉后发现的物品数下降 73%（§3.4¶1），它让另一个 GPT-4 判断任务是否完成并在失败时写建议（§2.3¶1），是[语言反馈强化](../concepts/verbal-reinforcement.md#设计空间)在同一任务多轮代码生成之间的用法。
- 课程决定了能不能学下去：自动课程换成随机课程，发现的物品数下降 93%，作者认为有些任务不按顺序就太难（§3.4¶1），技能要按难度依次积累，[技能库](../concepts/skill-library.md#开放问题)才有东西可组合。
- 用代码作动作空间既是能力来源也是门槛：程序能表达时间上延展、可组合的动作（§1¶3），但代码生成用 GPT-4 时发现的物品是 GPT-3.5 的 5.7 倍（§3.4¶1），动作全靠 Mineflayer 的高层 API 完成（§3.2¶5），见[技能库](../concepts/skill-library.md#开放问题)。
- 头条倍数比的是作者改写过的 NLP agent：ReAct、Reflexion、AutoGPT 原本不是为具身任务设计的，作者把它们改写成能在 MineDojo 里运行的版本（§3.2¶1），3.3 倍物品、15.3 倍解锁速度、2.3 倍移动距离都相对这些基线（§1¶6），见[技能库](../concepts/skill-library.md#共识与分歧)。

## 核心问题

作者认为当时的 LLM agent 都不是终身学习者，不能在长时间里逐步获取、更新、积累和迁移知识（§1¶1）；在原始动作上做强化学习或模仿学习，又难以系统探索、难以解释、难以泛化（§1¶1）。本质上这是开放世界里的持续学习问题：没有预设终点时，agent 要自己决定下一步学什么，把学会的东西存成以后能复用的形式，并判断自己是否真的学会了，而且不训练模型（§1¶3）。

## 核心洞察

程序天然能表示时间上延展、可以组合的动作（§1¶3）。把学会的行为写成程序，经验就能像函数库一样被检索和调用，新技能建立在旧技能之上，能力随时间复利增长（§1¶4）；这一切都通过黑盒 GPT-4 的提示完成，不需要访问参数（§1¶3）。

## 核心设计

整体结构见论文 Fig. 2。

1. **自动课程**：GPT-4 根据"发现尽可能多的不同东西"这一总目标、agent 当前状态、已完成和失败的任务，提出下一个任务（§2.1¶2）。作者把它看作上下文形式的 novelty search（§1¶4）；课程自下而上展开，随探索进度和当前状态调整（§2.1¶1）。
2. **技能库**：每个技能是一段可执行代码（§2.2¶1），提示要求写成通用、可复用的函数，以便组合出更复杂的函数（§2.2¶2）。技能以描述的 embedding 为键存入向量库；新任务用自生成的任务计划和环境反馈做查询，取前 5 个相关技能放进提示（§2.2¶3、Fig. 4）。
3. **迭代提示**：执行生成的程序，把环境反馈（例如"还差 7 个铁锭"）、解释器的执行错误、自我验证的批评放进下一轮提示，反复改代码（§2.3¶1、§2.3¶2）；代码生成 4 轮仍卡住，就向课程要另一个任务（§2.3¶2）。
4. **自我验证**：另起一个 GPT-4 作为 critic，读当前状态和任务，判断程序是否完成任务，失败时给出建议（§2.3¶1）。只有通过验证的程序才写进技能库（§2.3¶2），这样就不必为课程提出的每个新任务手写成功判定（§2.3¶1）。

## 效果

模型为 gpt-4-0314 和 gpt-3.5-turbo-0301，embedding 用 text-embedding-ada-002，环境基于 [MineDojo](../glossary.md#minedojo)，底层动作调用 [Mineflayer](../glossary.md#mineflayer) 的 JavaScript API（§3.1¶1）。基线为作者改写的 ReAct、Reflexion、[AutoGPT](../glossary.md#autogpt)（§3.2¶1）。

| 设置 | 基线 | 结果 | 锚点 |
|---|---|---|---|
| 探索，160 次提示迭代内发现的不同物品 | ReAct、Reflexion、AutoGPT | 63 个，是基线的 3.3 倍 | （§3.3¶2、§1¶6） |
| 科技树，木 / 石 / 铁 / 钻石工具所需提示迭代，3 次运行平均 | AutoGPT 92 / 94 / 135 / 未解锁；ReAct、Reflexion 四级都是 0/3 | 6 / 11 / 21 / 102，钻石工具只有 1/3 次成功 | （Tab. 1） |
| 同上，倍数 | 基线 | 木 15.3 倍、石 8.5 倍、铁 6.4 倍 | （§3.3¶3） |
| 同上，去掉技能库 | — | 7 / 9 / 29 / 未解锁 | （Tab. 1） |
| 地图上的移动距离 | 基线 | 2.3 倍 | （§3.3¶4、Fig. 7） |
| 新世界零样本，钻石镐 / 金剑 / 岩浆桶 / 指南针，50 次迭代内 | ReAct、Reflexion、AutoGPT 全部 0/3 | 19 / 18 / 21 / 18，全部 3/3 | （Tab. 2） |
| 同上，去掉技能库 | — | 36（2/3）/ 30 / 27 / 26 | （Tab. 2） |
| 同上，AutoGPT 加 Voyager 的技能库 | AutoGPT 全部 0/3 | 39（1/3）/ 30（1/3）/ 未解出 / 30（2/3） | （Tab. 2） |
| 消融，发现物品数 | 完整 Voyager | 随机课程 −93%；去掉自我验证 −73%；代码生成用 GPT-4 是用 GPT-3.5 的 5.7 倍 | （§3.4¶1、Fig. 9） |

## 局限与疑点

### 作者承认的

- GPT-4 API 很贵，是 GPT-3.5 的 15 倍，但代码质量离不开 GPT-4（§4¶1）。
- 迭代提示后仍会卡住、写不出正确技能；自我验证也会出错，例如不把蜘蛛丝当作打败蜘蛛的证据（§4¶2）。
- 课程会提出游戏里不存在的物品，如"铜剑"；代码会用无效燃料、调用不存在的函数（§4¶3）。
- 当时的 GPT-4 API 只支持文本，没有视觉感知（§3.5¶1）；动作依赖 Mineflayer 的高层 API，不解决 3D 感知和底层控制（§3.2¶5）。

### 本库判断的

- 基线都是作者改写的 NLP agent，给的目标是同一句"探索世界、尽量多拿物品"（论文附录 B.2），没有课程的 ReAct 和 Reflexion 几乎不动（§3.3¶2）。对比主要说明课程和技能库这套组合有用，不说明 Voyager 超过以前的 Minecraft 专用方法；作者也说明没有和基于像素的方法直接比较（§3.2¶5）。
- "唯一解锁钻石级"（§3.3¶3）是 3 次运行里成功 1 次（Tab. 1）。
- 零样本迁移的优势主要来自技能库以外的部分：没有技能库的 Voyager 在 4 个未见任务中 3 个全部解出、1 个 2/3（Tab. 2），技能库的作用是把所需迭代减少 22% 到 47%。去掉技能库后石制工具反而更快（9 对 11，Tab. 1）。
- 作者说组合技能能缓解其他持续学习方法的灾难性遗忘（§1¶4），实验没有测旧技能是否退化或被覆盖。
- 技能库只增不改，写入门槛是 GPT-4 的自我验证，而作者承认验证会误判（§4¶2）。论文没有讨论写错的技能怎样被发现和替换。
- 正文把科技树结果指向 "Fig. 2 and Table. 1"（§3.3¶3），Fig. 2 是系统结构图，结果实际在 Tab. 1。
- venue 记为 TMLR 2024：TMLR 在 jmlr.org 公布的已接收论文列表里收录了这篇，日期 2024-03，OpenReview 编号 ehfRiF0R3a，带 J2C 认证。本页读的是 arXiv v2（2023-10），TMLR 版本可能有改动；项目主页的 BibTeX 仍写 arXiv preprint。所属机构：NVIDIA（Guanzhi Wang、Ajay Mandlekar、Chaowei Xiao、Yuke Zhu、Linxi Fan、Anima Anandkumar），Caltech（Guanzhi Wang、Anima Anandkumar），UT Austin（Yuqi Xie、Yuke Zhu），Stanford（Yunfan Jiang），UW Madison（Chaowei Xiao）。

## 与其他工作的关系

- 与 [Reflexion](./202303-reflexion.md)：Voyager 把 Reflexion 改写成基线，并把自己的执行错误和自我验证模块都给了它（§3.2¶3），所以两者结果的差距来自课程和技能库，不来自验证。作者说自我验证同时检查成败、反思错误，比自我反思更全面（§2.3¶1）；本库判断：Reflexion 本来就有独立的评估器（[Reflexion](./202303-reflexion.md) §3¶1），差别在 Voyager 把评估和写建议合在一个 critic 里。两者都只在同一任务的多轮之间传递文字反馈，见[语言反馈强化](../concepts/verbal-reinforcement.md#设计空间)。
- 与 [ReAct](./202210-react.md)：ReAct 是基线之一（§3.2¶2）。Voyager 写代码前也先做 chain-of-thought 推理（§2.2¶2），但每一轮产出的是一整段程序，论文没有说自己建在 ReAct 循环之上，本库因此不挂[推理与行动交替](../concepts/interleaved-reasoning-acting.md)。
- 与 [Generative Agents](./202304-generative-agents.md)：Voyager 认为 Generative Agents 存储和检索经历用于规划，但 agent 的动作不可执行，也没有技能库（§5¶2）。
- 与 Code as Policies、ProgPrompt：这两篇已让 LLM 直接生成可执行的机器人策略（§5¶2），Voyager 加上的是把验证过的程序积累起来、反复组合。两篇本库未收录。
- 与 [ACE](./202510-ace.md) 和[记忆笔记](../concepts/memory-notes.md#设计空间)：三者都不改权重、把经验留给后续任务。ACE 存自然语言的策略和失败模式（[ACE](./202510-ace.md) §3.1¶1），Voyager 存可执行程序；前者由模型读后自己执行，后者检索后直接调用。见[技能库](../concepts/skill-library.md#设计空间)。
