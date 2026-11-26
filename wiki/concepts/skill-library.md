---
title: 技能库
type: concept
summary: agent 把验证成功的行为写成可执行代码存起来，按描述检索、组合成更复杂的技能，供之后的任务复用
topics: [continual-learning]
aliases: [skill library, executable skill library, 可执行技能库, 代码技能库]
added: 2026-11-27
status: emerging
relations:
  - { topic: continual-learning, rel: part-of }
  - { concept: memory-notes, rel: alternative-to, note: 两者都不改权重、把经验留给之后的任务；技能库存可执行代码，检索后直接调用或组合，记忆笔记存自然语言的规则和教训，由模型读后自己执行 }
---

## 定义

来源：[Voyager](../papers/202305-voyager.md)

agent 每完成并验证一个任务，就把完成它的程序作为一个技能存进库里，以程序描述的 embedding 为键；遇到新任务时按任务计划和环境反馈检索相关技能放进提示，新技能可以调用旧技能，复杂行为由简单程序组合而成（§1¶4、§2.2¶3）。模型权重不变，学到的东西全部在库里（§1¶3）。它要解决的问题是：LLM agent 不能在长时间里积累和迁移学到的东西（§1¶1），而用代码表示的行为天然可以在时间上延展、可以组合（§1¶3）。

本库收录的最早来源是 2023-05 的 Voyager。Voyager 说此前的 LLM agent 都缺少用于发展更复杂行为的技能库（§5¶2）；Code as Policies 和 ProgPrompt 更早让 LLM 生成可执行策略（§5¶2），但没有把程序积累下来，本库未收录这两篇。

## 演化

## 设计空间

经验以什么形式留给之后的任务，下表比较几条路线。前两行取自 Voyager 的实验，第三行取自 ACE，第四行取自播客。

| 路线 | 经验存成什么 | 怎么复用 | 证据与疑点 |
|---|---|---|---|
| 不留经验 | 无技能库，每个子目标重新写代码 | — | AutoGPT 在新世界的四个未见任务上一个也解不出（[Voyager](../papers/202305-voyager.md) Tab. 2） |
| 代码技能库 | 通过自我验证的程序，按描述 embedding 索引（[Voyager](../papers/202305-voyager.md) §2.2¶3） | 检索前 5 个放进提示，直接调用或组合（[Voyager](../papers/202305-voyager.md) Fig. 4） | 同一技能库交给 AutoGPT，四个任务里能解出三个（[Voyager](../papers/202305-voyager.md) Tab. 2）；写进库的门槛是 LLM 的自我验证，会误判（[Voyager](../papers/202305-voyager.md) §4¶2） |
| [记忆笔记](memory-notes.md) | 自然语言的策略、领域概念和失败模式（[ACE](../papers/202510-ace.md) §3.1¶1） | 模型读后自己决定怎么做 | 本库判断：不依赖现成的动作 API，代价是每次都要模型重新把规则落实成动作；两种形式没有素材直接对比过 |
| 封装成功轨迹的 skill | 挑出做对的那次，封装成 reusable skill | 后续直接调用 | NeoCognition 早期为此搭了一条 pipeline，谷雨说现在让 Opus 5.5 自己实现这套流程很快（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:06:08]） |

## 共识与分歧

来源：[Voyager](../papers/202305-voyager.md)

- 技能库的作用在后期和迁移时才明显。去掉技能库后探索在后期停滞（§3.4¶1），科技树前两级反而不慢：石制工具 9 次迭代，带技能库是 11 次（Tab. 1）。新世界零样本时，没有技能库的 Voyager 四个任务里三个 3/3 解出（Tab. 2），技能库主要把迭代数从 26–36 降到 18–21（Tab. 2）。
- 作者把技能库看作可以即插即用的资产，因为它也让 AutoGPT 变强（§3.3¶5）。本库判断：AutoGPT 拿到技能库后成功率只有 1/3 到 2/3（Tab. 2），技能库要配合 Voyager 的迭代提示和自我验证才能完全发挥。
- 头条对比的基线是作者改写的 NLP agent（§3.2¶1），本库还没有第二个来源检验技能库本身的收益。

## 开放问题

- 写错的技能怎样发现和替换？技能库只增加，写入只看 GPT-4 的自我验证，而作者承认验证会误判（[Voyager](../papers/202305-voyager.md) §4¶2）。
- 作者说组合技能能缓解灾难性遗忘（[Voyager](../papers/202305-voyager.md) §1¶4），但实验没有测旧技能是否退化；底层 API 或环境变化后旧代码还能不能用，也没有测。
- 代码作动作空间要求有现成的高层 API 和很强的代码模型：Voyager 依赖 Mineflayer（[Voyager](../papers/202305-voyager.md) §3.2¶5），代码生成用 GPT-4 时发现的物品是 GPT-3.5 的 5.7 倍（[Voyager](../papers/202305-voyager.md) §3.4¶1）。没有这样 API 的领域能否用同一路线？
- 技能要按难度依次积累才能组合：随机课程让发现的物品数下降 93%（[Voyager](../papers/202305-voyager.md) §3.4¶1）。在没有课程的真实部署里，谁来决定先学什么？
- 模型自己就能临时写出这些流程时，还需要预先积累的技能库吗？谷雨的观察是封装 skill 的 pipeline 现在可以让模型自己实现（[播客页](../podcasts/20261108-crossing-gu-yu.md) [00:06:08]），这是否意味着技能库的收益随模型变强而缩小，还没有素材检验。
