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
- [记忆笔记](concepts/memory-notes.md) — 模型把跨任务学到的规则和教训写成笔记，反复改写或逐条补充，让后续任务做得更好
- [连续任务流评测](concepts/streaming-task-evaluation.md) — 把前后依赖的任务按顺序连成一条流让 agent 边做边学，用来测持续学习能力
- [记忆流与反思](concepts/memory-stream-reflection.md) — 把全部经历按时间记成自然语言流，按近因、重要性、相关性取回，并定期提炼出更高层的反思写回
- [写入时记忆整合](concepts/memory-consolidation.md) — 新信息写入时取出相似旧记忆，由 LLM 决定新增、改写、合并或删除，让记忆库保持一致
- [长上下文位置偏差](concepts/long-context-position-bias.md) — 模型用长输入里的信息时，开头和结尾处最好、中间最差，准确率随位置呈 U 形
- [提示词压缩](concepts/prompt-compression.md) — 在不改目标模型的前提下删减提示词里的 token，只保留目标模型完成任务需要的部分
- [推理与行动交替](concepts/interleaved-reasoning-acting.md) — agent 在同一条轨迹里交替写自然语言推理和执行环境动作，推理指导下一步动作，动作结果再供推理使用
- [自监督工具使用学习](concepts/self-supervised-tool-learning.md) — 模型自己在无标注文本里插入候选工具调用，只保留能降低后续 token 损失的调用，再用这些数据微调自己
- [面向 agent 的计算机接口](concepts/agent-computer-interface.md) — 把 LM agent 当作软件的一类新用户，按模型的能力和局限设计它能用的命令、看到的反馈和历史整理方式
- [语言反馈强化](concepts/verbal-reinforcement.md) — 任务失败后让 LLM 把成败信号写成文字反思，放进同一任务下一次尝试的上下文，不改权重地改进做法
- [技能库](concepts/skill-library.md) — agent 把验证成功的行为写成可执行代码存起来，按描述检索、组合成更复杂的技能，供之后的任务复用
- [自举推理](concepts/bootstrapped-reasoning.md) — 模型为训练题自写推理过程，只留得出正确答案的来微调自己，再用新模型重新生成，循环提升推理能力
- [自我奖励](concepts/self-rewarding.md) — 被训练的模型同时充当自己的奖励模型，用 LLM-as-a-Judge 给自己的回答打分，再用这些偏好数据训练自己
- [自我修改的 agent](concepts/self-modifying-agent.md) — agent 改写自己的代码，包括工具、提示和工作流，用 benchmark 上的实测结果决定改动是否保留

## 论文

- [STaR](papers/202203-star.md) — 模型自己写推理，只留答对的来微调并迭代，答错的题给出答案让它反推推理；GPT-J 在 CQA 上达 72.5%
- [ReAct](papers/202210-react.md) — 让 LLM 在一条轨迹里交替写推理和执行动作，只靠少量示例提示就在 ALFWorld、WebShop 上超过模仿学习
- [Toolformer](papers/202302-toolformer.md) — 让模型自己在语料里插入 API 调用，只留能降低后续 token 损失的调用再微调，6.7B 模型零样本学会用五种工具
- [Reflexion](papers/202303-reflexion.md) — 把失败反馈写成文字反思存进记忆，同一任务下一次尝试时读回，不改权重，HumanEval pass@1 达 91%
- [Generative Agents](papers/202304-generative-agents.md) — 用记忆流、反思和规划驱动 25 个 agent 在沙盒小镇里生活，行为比消融版本和众包扮演更可信
- [Voyager](papers/202305-voyager.md) — Minecraft 里由 GPT-4 自定课程，把验证过的代码存进技能库并组合复用，不改权重持续学会新技能
- [Lost in the Middle](papers/202307-lost-in-the-middle.md) — 相关信息放在长输入中间时模型表现最差，呈 U 形曲线；扩了窗口的版本并不更会用上下文
- [LLMLingua](papers/202310-llmlingua.md) — 用小模型的困惑度由粗到细删减提示词，GSM8K 上压缩 20 倍只掉 1.5 个点，适用于黑盒 API
- [MemGPT](papers/202310-memgpt.md) — 借操作系统的虚拟内存，让模型用函数调用在上下文和外部存储之间换入换出，突破固定窗口
- [A-MEM](papers/202502-a-mem.md) — 仿 Zettelkasten 把每条记忆写成带标签的笔记，写入时自动建链并改写相关旧笔记
- [Mem0](papers/202504-mem0.md) — 从每轮对话抽取事实，由 LLM 对相似旧记忆选择增删改，LOCOMO 上接近全文效果且延迟低得多
- [Self-Rewarding Language Models](papers/202401-self-rewarding-language-models.md) — 同一个模型既生成回答又用 LLM-as-a-Judge 给自己打分，组成偏好对做迭代 DPO，评判能力也随之提升
- [SWE-agent](papers/202405-swe-agent.md) — 把 LM agent 当作新一类用户，为它设计搜索、看文件和带 linter 的编辑命令，同一模型解决率明显提高
- [The AI Scientist](papers/202408-ai-scientist.md) — LLM 从想法、查新、写代码跑实验到写论文和自动评审一条龙做 ML 研究，每篇约 15 美元
- [Darwin Gödel Machine](papers/202505-darwin-godel-machine.md) — coding agent 改写自身代码、实测后存档所有可用变体，SWE-bench 子集从 20% 到 50%
- [ACE](papers/202510-ace.md) — 把上下文当作逐条积累的 playbook，只做增量更新避免整段重写塌缩，AppWorld 和金融任务上超过提示优化基线
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
- [California Institute of Technology](entities/caltech.md) — 美国加州理工学院，位于加州帕萨迪纳的私立研究型大学
- [Google](entities/google.md) — 美国科技公司，本页同时收录 Google Research 和 Google DeepMind 参与的素材
- [Jack Clark](entities/jack-clark.md) — Anthropic 联合创始人，长期负责政策工作，撰写 AI 周报 Import AI
- [Massachusetts Institute of Technology](entities/mit.md) — 美国麻省理工学院，位于马萨诸塞州剑桥的私立研究型大学
- [Mem0（公司）](entities/mem0.md) — 开发 AI agent 长期记忆层的公司，产品和论文都叫 Mem0
- [Meta](entities/meta.md) — 美国科技公司，本页同时收录 Meta AI Research 和 MSL 参与的素材
- [Microsoft](entities/microsoft.md) — 美国科技公司，本页同时收录 Microsoft Research 参与的素材
- [Northeastern University](entities/northeastern.md) — 美国东北大学，位于马萨诸塞州波士顿的私立研究型大学
- [NVIDIA](entities/nvidia.md) — 美国 GPU 和 AI 计算平台公司，本页同时收录 NVIDIA Research 参与的素材
- [New York University](entities/nyu.md) — 美国纽约大学，位于纽约市的私立研究型大学
- [Princeton University](entities/princeton.md) — 美国普林斯顿大学，位于新泽西州普林斯顿的私立研究型大学
- [SambaNova Systems](entities/sambanova.md) — 美国 AI 公司，开发 AI 芯片和大模型推理平台
- [Sakana AI](entities/sakana-ai.md) — 总部位于东京的 AI 公司，研究受自然启发的方法和 AI 自动化科研
- [Stanford University](entities/stanford.md) — 美国斯坦福大学，位于加州斯坦福的私立研究型大学
- [The University of Texas at Austin](entities/ut-austin.md) — 美国得克萨斯大学奥斯汀分校，位于得州奥斯汀的公立研究型大学
- [UC Berkeley](entities/uc-berkeley.md) — 美国加州大学伯克利分校，位于加州伯克利的公立研究型大学
- [University of British Columbia](entities/ubc.md) — 加拿大不列颠哥伦比亚大学，位于温哥华的公立研究型大学
- [University of Oxford](entities/oxford.md) — 英国牛津大学，本页同时收录其 FLAIR 实验室参与的素材
- [University of Washington](entities/uw.md) — 美国华盛顿大学，位于西雅图的公立研究型大学
- [University of Wisconsin–Madison](entities/uw-madison.md) — 美国威斯康星大学麦迪逊分校，位于威斯康星州麦迪逊的公立研究型大学
- [Vector Institute](entities/vector-institute.md) — 位于加拿大多伦多的非营利 AI 研究机构
