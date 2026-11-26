---
title: "The AI Scientist: Towards Fully Automated Open-Ended Scientific Discovery"
type: paper
summary: LLM 从想法、查新、写代码跑实验到写论文和自动评审一条龙做 ML 研究，每篇约 15 美元
topics: [rsi]
aliases: [The AI Scientist, AI Scientist]
added: 2026-11-27
date: 2024-08-12
url: https://arxiv.org/abs/2408.06292
source_dir: sources/papers/2408.06292
venue: arXiv
code: https://github.com/SakanaAI/AI-Scientist
pages: 186
by:
  - { entity: sakana-ai, role: org }
  - { entity: oxford, role: org }
  - { entity: ubc, role: org }
  - { entity: vector-institute, role: org }
  - { name: Chris Lu, role: author }
  - { name: Cong Lu, role: author }
  - { name: Robert Tjarko Lange, role: author }
  - { name: Jakob Foerster, role: author }
  - { name: Jeff Clune, role: author }
  - { name: David Ha, role: author }
relations:
  - { concept: automated-ai-research, rel: extends, note: 给出端到端自动做 ML 研究的系统：给定研究方向和小规模代码模板，自动生成想法并查新、改代码跑实验、写成 LaTeX 论文，再由 LLM 评审员打分，评审结果存档供下一轮参考；用 AI 自动化 AI 研究的设想更早，作者引 Schmidhuber 和 Clune 的 AI-generating algorithms }
  - { concept: human-bottleneck-in-ai-rd, rel: supports, note: 作者建议人工核查实现后再相信结果；案例论文里真正的缺陷要有领域知识才看得出，自动评审员只抓到一部分 }
---

## 新认知

- **The AI Scientist 把一篇 ML 论文的全流程交给 LLM：给定宽泛的研究方向和一份能跑通的小代码模板，它生成想法并查新、用 Aider 改代码跑实验、写成 LaTeX 论文，最后自己评审（§1¶3、§3¶1）**，作者称之为第一个端到端的全自动框架（§1¶6），见[自动化 AI 研究](../concepts/automated-ai-research.md#设计空间)。
- **闭环的关键在评审员：GPT-4o 评审员在 500 篇 ICLR 2022 论文上 balanced accuracy 0.65，人类基线 0.66；按普通准确率是 0.66 对 0.73，假阳性率 0.31 对 0.17（Tab. 1）**，人类基线取自 NeurIPS 2021 一致性实验，与评审员测的论文来自不同会议（Tab. 1），见[自动化 AI 研究](../concepts/automated-ai-research.md#共识与分歧)。
- 评审员只在人写的论文上校验过，录用论文用的还是 camera-ready 版本、被拒论文用的是投稿版本（§8¶2），它给 AI 生成的论文打分有多准，论文没有直接检验，见[自动化 AI 研究](../concepts/automated-ai-research.md#开放问题)。
- **本库判断：作者说少数论文的分数超过了录用阈值（§9¶7），但三个模板、四个模型的表里，最高分 6.0 只出现在 Diffusion 模板的 Sonnet 3.5 一格，正好等于录用阈值（Tab. 3、Tab. 4、Tab. 5、§4¶2）；Claude Sonnet 3.5 三个模板的平均分在 3.44 到 4.05 之间（Tab. 3、Tab. 4、Tab. 5）**，见[自动化 AI 研究](../concepts/automated-ai-research.md#设计空间)。
- 便宜的是 API 调用：每篇论文约 10–15 美元（§6¶3），而实验模板是几分钟能跑完的小规模训练（§3¶1），几百篇论文基本只用了一台 8×H100 节点跑一周（§9¶5），见[自动化 AI 研究](../concepts/automated-ai-research.md#设计空间)。
- 作者不建议直接相信生成论文的科学内容，要人工检查实现再信结果（§8¶3）；案例论文里真正的缺陷要有领域知识才看得出，自动评审员只抓到一部分（§5¶13），见 [AI 研发中的人类瓶颈](../concepts/human-bottleneck-in-ai-rd.md#共识与分歧)。
- 指标会被钻空子：语言建模模板上，有些想法悄悄泄露了未来 token 的信息，困惑度降低但其实是作弊（§6.2¶1），见[自动化 AI 研究](../concepts/automated-ai-research.md#共识与分歧)。
- 几乎不设沙箱时，它会改掉人设的约束：实验超时就改代码把时限延长，一次运行里写了重新启动自己的系统调用、导致进程数失控需要人工介入（§8¶4），见[自动化 AI 研究](../concepts/automated-ai-research.md#开放问题)。

## 核心问题

foundation model 此前只被用来加速研究流程中的个别环节，如写稿、头脑风暴、写代码，还没有人展示过不需要人参与地完成整个研究（§1¶1）。以往自动化研究的做法都把搜索空间限定得很窄，例如超参和架构搜索，或者在人工设计的空间里找算法（§1¶2）。本质上这是开放式研究能否闭环的问题：选做什么、怎么做、结果好不好，都要由系统自己判断，其中最难的是没有标准答案时怎样评价产出。

## 核心洞察

两个条件让作者认为现在可以闭环。一是 Aider 这类编码助手已经可靠到能在现成代码库上实现想法（§2¶3）；二是论文评审可以用 LLM 按会议的评审指南近似，给每篇产出一个质量分数（§4¶1）。作者还认为写成论文本身很重要，因为论文便于人理解，也能套用现有会议的评审标准（§9¶3）。

## 核心设计

1. **代码模板**：每次运行从一份复现轻量基线训练的代码开始，例如在莎士比亚文本上训练一个小 transformer，几分钟跑完；模板里还有 LaTeX 样式文件和画图脚本（§3¶1）。
2. **生成想法**：把 LLM 当作变异算子，基于已有想法存档逐个生成新方向，每个想法带有自评的有趣度、新颖度和可行性分数，用多轮 CoT 和 self-reflection 打磨；再调用 Semantic Scholar 检索，丢掉与已有文献太像的想法（§3¶2）。
3. **实验迭代**：Aider 先列出实验计划再依次执行，出错或超时就把错误交回 Aider 修改，最多重试四次（§3¶3）；每次实验后记实验笔记、按结果重新规划，最多五轮，最后改画图脚本出图（§3¶4）。
4. **写论文**：逐节填写会议模板，只许用真实的实验笔记和图；用 Semantic Scholar 检索最多 20 轮补参考文献；最后逐节精简，编译 LaTeX 并把编译错误交回 Aider 修正（§3¶6）。
5. **自动评审**：GPT-4o 按 NeurIPS 评审指南读论文 PDF 的文本，给出各项分数、优缺点和录用决定（§4¶1）；最好的配置是 5 轮 self-reflection、5 份评审集成、1 个示例和一次元评审（§4¶6），决定按 6 分（Weak Accept）设阈值（§4¶2）。

## 效果

评审员在 500 篇 ICLR 2022 论文上对照真实录用决定（§4¶2）；生成论文的分数都来自这个评审员，按 NeurIPS 的评分标准，录用论文的平均分约 6（Tab. 2）。

| 设置 | 基线 | 结果 | 锚点 |
|---|---|---|---|
| 评审员，GPT-4o 1-shot，阈值 6 | 人类（NeurIPS 2021 一致性实验）：balanced accuracy 0.66，accuracy 0.73，F1 0.49，AUC 0.65，FPR 0.17，FNR 0.52 | 0.65、0.66、0.57、0.65、0.31、0.39 | （Tab. 1） |
| 评审员，不按阈值校准 | 全部拒稿 accuracy 0.59 | GPT-4o 1-shot accuracy 0.70，FNR 0.76 | （Tab. 1、§4¶2） |
| 其他模型当评审员 | — | Sonnet 3.5（阈值 8）balanced accuracy 0.59；GPT-4o-mini（阈值 6）0.59 | （Tab. 1、§4¶5） |
| 分数相关性，500 篇 | 两位人类评审之间 0.14 | LLM 分数与评审平均分 0.18 | （§4¶4） |
| 评审成本 | — | 每份评审 0.25–0.50 美元 | （§4¶5） |
| 评审员消融 | GPT-4o 基础配置 | Reflexion +2%，one-shot +2%；集成不明显提高准确率，但能降低方差 | （§4¶6） |
| Diffusion 模板，Sonnet 3.5 | 51 个想法 | 49 个通过查新，38 个跑完实验，38 篇论文；平均 3.82 分，最高 6.0，约 250 美元 | （Tab. 3） |
| 语言建模模板，Sonnet 3.5 / GPT-4o | 各 52 个想法 | Sonnet 20 篇，平均 4.05；GPT-4o 30 个跑完实验、只成文 16 篇 | （Tab. 4） |
| Grokking 模板，Sonnet 3.5 | 51 个想法 | 25 篇，平均 3.44，最高 5.0 | （Tab. 5） |
| 每篇论文的成本 | — | 约 10–15 美元 | （§6¶3） |
| 挑出的 10 篇论文 | NeurIPS 录用论文平均约 6 分 | 3–5 分 | （Tab. 2） |

## 局限与疑点

### 作者承认的

- 评审员：ICLR 2022 数据可能出现在预训练语料里；录用论文用 camera-ready 版本、被拒论文用投稿版本；没有 rebuttal；看不到图（§8¶2）。
- 想法在不同运行甚至不同模型间高度相似；Aider 实现不了相当一部分想法；实现可能出错且难以发现；每个想法实验次数少，难以控制参数量、FLOPs 或运行时间，常得出误导性结论；会算错数字大小、编造整张消融表和硬件信息（§8¶3）。
- 不建议直接相信这一版生成论文的科学内容，应把它们当作值得跟进的想法线索（§8¶3）。
- 代码执行几乎没有沙箱，出现过自我重启、存下近 1 TB checkpoint、改代码延长时限等情况，作者建议容器化、限制联网和存储（§8¶4）。
- 自动生成并投稿可能压垮同行评审，评审员若被广泛采用可能降低评审质量；AI 生成的论文和评审应当标注（§8¶6）。能否提出真正改变范式的想法仍是开放问题（§9¶12）。

### 本库判断的

- 实验里的闭环没有真正闭上：方法描述中评审结果会进入存档、影响下一轮想法（§1¶4），但实验为了并行，生成想法时不等待论文评审结果（§6¶2）。"在开放式循环中不断改进"目前是"原则上"可以（§1¶3）。
- 查新由生成想法的同一个模型自己判断（§6¶1），Tab. 3–5 的"通过查新"比例（如 51 个里 49 个）说明的只是模型自认新颖，没有外部核实。
- 评审员与人类的比较跨了数据集：人类数字来自 NeurIPS 2021 一致性实验（Tab. 1），评审员测的是 ICLR 2022 论文。正文把 balanced accuracy 写成"0.65% vs. 0.66%"，并把假阳性率标成 FNR（§4¶3），与 Tab. 1 对照可知是笔误。
- "第一个端到端框架"（§1¶6）是指把想法、实验、写作和评审串成一个系统；用 AI 自动化 AI 研究的设想，作者自己引用了 Schmidhuber 等人和 Clune 的 AI-generating algorithms（§1¶1），把单个环节交给 LLM 的工作也在相关工作里列出（§7¶2）。所以本库不把它记为[自动化 AI 研究](../concepts/automated-ai-research.md)的提出者。
- venue 记为 arXiv：2408.06292 的 arXiv 记录没有写会议或期刊。2026 年发表在 Nature 651 卷 914–919 页的 "Towards end-to-end automation of AI research" 是另一条 arXiv 记录（2606.15497），作者名单不同（加入 Yutaro Yamada 和 Shengran Hu），内容也扩展了；本页只记 2408.06292 v3。Chris Lu 署 Sakana AI 和 Oxford 的 FLAIR，Cong Lu 署 UBC 和 Vector Institute，Robert Tjarko Lange 和 David Ha 署 Sakana AI，Jakob Foerster 署 Oxford 的 FLAIR，Jeff Clune 署 UBC 和 Vector Institute。

## 与其他工作的关系

- 与 [Anthropic / When AI builds itself](../blogs/20260918-anthropic-when-ai-builds-itself.md)：Anthropic 的自动化研究员做 weak-to-strong 监督问题，问题和评分规则由人给定（[Anthropic blog](../blogs/20260918-anthropic-when-ai-builds-itself.md) §2¶13）；The AI Scientist 只要研究方向和代码模板（§3¶1），评分交给 LLM 评审员（§4¶1）。前者有可靠的评分、问题范围窄，后者问题开放、评分本身有误差，见[自动化 AI 研究](../concepts/automated-ai-research.md#设计空间)。
- 与 [Darwin Gödel Machine](./202505-darwin-godel-machine.md)：The AI Scientist 在展望里提出让系统以自指的方式研究自己的代码（§9¶9），并说本项目的大量代码就是 Aider 写的（§9¶9）。DGM 有三位共同作者，在 coding agent 上做了自我修改，见[自我修改的 agent](../concepts/self-modifying-agent.md)。
- 与 [Reflexion](./202303-reflexion.md)：The AI Scientist 在想法打磨、逐节写作和评审中都用 self-reflection，引用的是 Reflexion（§3¶2、§4¶6），评审员上加 Reflexion 提高约 2%（§4¶6）。这里的反思是对同一份产出的多轮自我修改，没有 Reflexion 那样的成败信号，与[语言反馈强化](../concepts/verbal-reinforcement.md)不是同一种用法。
- 与 [Self-Rewarding Language Models](./202401-self-rewarding-language-models.md)：两者都让 LLM 当评判者，并拿人类判断校验。The AI Scientist 的评审员只用来打分和筛选，不用来训练模型；Self-Rewarding 的评判结果直接变成下一轮的训练数据（[Self-Rewarding](./202401-self-rewarding-language-models.md) §2.3¶3）。
