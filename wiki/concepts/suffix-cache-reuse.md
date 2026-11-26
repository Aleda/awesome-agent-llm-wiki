---
title: 后缀缓存复用
type: concept
summary: 上下文中段被编辑后，复用未改动后缀的旧 KV cache，只重新计算新插入的部分
topics: [context]
aliases: [Suffix Cache Reuse, SCR]
added: 2026-11-27
status: emerging
relations:
  - { topic: context, rel: part-of }
---

## 定义

来源：[Context Language Models](../papers/202609-context-language-models.md)

上下文中间一段被替换后，保留其后未改动 token 的已算缓存并重排位置，只预填新插入或追加的 token（§4.3¶1）。它解决的问题是：标准前缀缓存只复用第一个不匹配位置之前的部分，中段编辑之后的内容即使没变也要全部重算（Fig. 4），让频繁改写上下文的 agent 推理成本上升。

## 演化

## 设计空间

来源：[Context Language Models](../papers/202609-context-language-models.md)

| 做法 | 编辑后复用什么 | 精确性 | 代表 |
|---|---|---|---|
| 标准前缀缓存 | 只复用匹配的前缀，之后全部重预填（Fig. 4） | 精确 | SGLang 的基数树缓存（论文附录 B） |
| 后缀缓存复用 | 复用所有留存 token 的缓存，只预填新插入部分 | 近似：后缀缓存仍编码旧前缀（§4.3¶1） | CLM 的 SGLang 补丁（§5.3¶1） |
| 混合架构的线性注意力层 | 从编辑前的循环状态快照继续，编辑只在全注意力层体现 | 近似 | CLM（Fig. 12） |
| 其他非前缀复用 | 预计算提示模块、RAG 文档块复用后选择性重算、代码编辑后修正位置 | 各异 | Prompt Cache、CacheBlend、EPIC、PIE、Memento，CLM 附录 A 列举，本库尚未录入原文 |

## 共识与分歧

来源：[Context Language Models](../papers/202609-context-language-models.md)

- 目前只有 CLM 一份素材。作者报告在 BrowseComp-Plus 上，SCR 以标准 SGLang 65.0% 的 FLOPs 达到相同表现（§5.3¶1），并认为旧前缀留下的痕迹有时反而有益（§4.3¶1）。
- 作者的数据也显示，SCR 的额外复用大半来自对话模板剥离推理 token，而非模型的上下文编辑（Fig. 14），所以它对不编辑上下文的普通推理服务同样适用。
- 另一种改写上下文的方式付出的缓存代价更大：频繁压缩每次都用"原任务 + 交接摘要"重开对话，只有系统提示和任务这段前缀还能命中。NVIDIA 论文报告，GPT 5.6 Sol 在 SWE-bench Verified 上压缩阈值从 48K/36K 收紧到 16K/12K，缓存命中的输入从 94.2M 降到 45.8M token，基线为 100.2M（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) Tab. 3）。摘要本身是新写的，SCR 能复用的部分很少；这条路线靠缩小部署窗口来省钱（[NVIDIA 论文](../papers/202611-you-dont-need-long-context.md) Fig. 4），见[频繁上下文压缩](frequent-context-compaction.md)。

## 开放问题

来源：[Context Language Models](../papers/202609-context-language-models.md)

- 近似复用对准确率的影响只在 SGLang 和深度研究任务上测过（§5.3¶1、Fig. 11），换到其他任务和推理框架是否仍然无损？
- 每次编辑搬移多少段（K）最合适？作者的小规模实验在 K=6 附近收益饱和（Fig. 13），但样本只有 64 题。
- 混合架构下前缀缓存本身还有大量重复预填（Fig. 15），在更细粒度的位置保存循环状态能否一并解决？
