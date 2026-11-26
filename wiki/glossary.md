---
title: 术语表
type: raw
---

收录产品名、模型名、benchmark 和缩写，每条一两句定义，不建独立概念页。格式：

```
## <术语>

一两句定义。
```

正文中链接术语用 `[术语](../glossary.md#<slug>)`，`slug` 为术语转小写后，连续的非 `[a-z0-9]` 字符合并为一个 `-` 并去掉首尾 `-`。

## AA-LCR

Artificial Analysis Long Context Reasoning，Artificial Analysis 发布的长上下文推理 benchmark：100 道人工编写的题目，每题要跨一组平均约 100K token 的真实文档综合证据、多步推理作答。

## Amdahl's law

Amdahl 定律：系统中只有一部分被加速时，整体加速受未被加速部分所占的比例限制。Anthropic 2026-09 的 blog 用它说明 AI 研发局部加速后瓶颈会转移到人工审查等环节。

## Apprentice Bench

NeoCognition 的 continual learning benchmark（截至 2026-11 未公开）：据其联创谷雨介绍，100 道建筑行业会计报账题，每道涉及公司特有的规则和流程，要按顺序连着做，后面的题依赖前面学到的知识。

## BrowseComp-Plus

在 OpenAI 的 BrowseComp 基础上构建的深度研究类 benchmark，为问题配了一个固定的文档语料库，agent 只在这个语料库里检索。语料固定后结果可以复现，也能把检索器的效果和 agent 的推理能力分开评估。

## Claude Code

Anthropic 的编程 agent，2025-02 以 research preview 形式发布，能在终端里读写代码、运行命令。

## Claude Mythos Preview

Anthropic 以预览形式提供的模型，2026 年发布。Anthropic 2026-09 的 blog 中训练代码提速、研究下一步判断和员工问卷等内部指标都用到它。

## Claude Opus 5.5

Anthropic Claude Opus 系列的一个版本，2026-11 前已发布。十字路口 2026-11-08 一期播客里，嘉宾谷雨用它举例说明 Computer Use 的操作层面已基本解决。

## ContextBench

CLM 论文（arXiv 2609.37725）提出的上下文管理诊断 benchmark，含 Needle Retention、Sudoku Sketchpad、KV Store、Log Triage 四个合成任务。任务不需要额外推理或知识，输入总量最高到上下文上限的 24 倍，只测 agent 怎样管理上下文。

## CORE-Bench

评测 agent 计算复现能力的 benchmark（Computational Reproducibility Agent Benchmark）：给定已发表论文附带的代码和数据，agent 要配好环境、跑通代码，并回答关于运行结果的问题。

## DGX Spark

NVIDIA 的桌面级 AI 计算机，128GB 统一内存。You don't need long context 论文（arXiv 2611.05306）用它测本地部署时生成延迟和显存随上下文长度的变化。

## EdgeBench

在真实软件仓库里做长时间优化的 benchmark：agent 在无网络的容器里改进一个代码库，由评测器按 0–100 打分。CLM 论文从中选了 10 个任务，称为 EdgeBench-10，每次运行 12 小时。

## estimated optimized retail cost

You don't need long context 论文（arXiv 2611.05306）定义的成本估算：以闭源模型的标价为完整窗口下的价格，按实测吞吐比把价格线性降到 16K 窗口时的约 20%，再按新输入、缓存输入和输出 token 分别计价。它假设服务方按窗口大小部署和定价，不是现行实际价格。

## FRAMES

Google 发布的多跳问答 benchmark，824 道题，每题要综合 2 到 15 篇 Wikipedia 文章作答。You don't need long context 论文把它改成 agent 在固定 Wikipedia 语料里逐步检索的形式。

## GRPO

Group Relative Policy Optimization，DeepSeekMath（2024）提出的强化学习算法。对同一个提示采样一组回答，用组内奖励的相对高低估计优势，因此不需要单独训练价值模型（critic）。

## Heilbronn triangle problem

Heilbronn 三角形问题：在单位区域内放置 n 个点，使任意三点构成的三角形中面积最小的那个尽可能大。AlphaEvolve 和 OpenEvolve 把它用作数学优化测试题。

## LOONG

多文档长上下文问答 benchmark，1,600 道题，一道题通常依赖多份完整的财报、法律案例或论文，中英文都有，证据有意分散在多份文档里。

## METR time horizon

METR 提出的能力度量：在一组任务上，模型能以 50% 可靠度完成的任务，对应熟练的人需要多长时间。Anthropic 2026-09 的 blog 引述这一时长约每四个月翻一番。

## Mind2Web

OSU NLP 组 2023 年发布的 web agent benchmark，任务取自真实网站，要求 agent 按自然语言指令完成网页操作。Online-Mind2Web 是它在真实在线网站上评测的变体。

## mini-swe-agent

SWE-agent 团队发布的极简软件工程 agent harness：每轮只发一个 Bash 命令，动作和结果逐条追加进对话。You don't need long context 论文以它为基础 harness，并推广出面向非编程任务的 mini-agent。

## NeoLab

业内对新一批 AI 研究型创业公司的称呼，介于头部前沿实验室和应用型创业公司之间，通常由研究者创办、以研究方向立身。

## NIAH

Needle in a Haystack，在长篇无关文本的指定深度插入一句目标事实，再提问这条事实，用来测模型在长输入中的检索能力。

## OpenEvolve

社区开发的开源框架，仿照 DeepMind 的 AlphaEvolve 实现，并非 DeepMind 官方发布。LLM 反复提出程序改动，评测函数给每个候选程序打分，按进化算法保留得分更高的版本并在其上继续变异。

## prefix-reuse FLOPs

CLM 论文定义的推理成本指标：按带前缀缓存的推理服务计算整条轨迹的理论 FLOPs，包括解码、预填，以及上下文中段被编辑后从第一个不匹配位置起的重预填。

## Project Glasswing

Anthropic 的网络安全项目，用 Claude Mythos Preview 在重要软件系统中查找漏洞。

## Qwen

阿里巴巴通义团队发布的开源大模型系列。CLM 论文用到的 Qwen3.6-27B 是混合架构，64 层中 48 层为线性注意力；另一个是 Qwen3.5-9B。

## RULER

NVIDIA 发布的合成长上下文测试集，13 个任务，包括多种 needle 检索变体、变量追踪、高频词提取和多跳问答，用来测模型的有效上下文长度。

## SGLang

开源的 LLM 推理服务框架。它的 RadixAttention 用基数树管理 KV cache，让共享前缀的请求复用已算好的缓存。

## Software World

CLM 论文自建的多仓库优化任务：六个 agent 各负责一个仓库（requests、urllib3 和四个下游包），并行工作 24 小时以上提升性能，在 agent 看不到的下游包基准上按几何平均加速比打分。

## SWE-bench

Princeton 团队 2023 年发布的软件工程 benchmark，任务取自真实 GitHub 仓库的 issue：模型要生成代码补丁，用当初修复该 issue 的 PR 中的测试判定是否解决。SWE-bench Verified 是 OpenAI 于 2024 年发布的 500 题子集，题目经过人工核验。

## TBLite

OpenThoughts-TBLite，由 OpenThoughts-Agent 团队发布的终端 agent benchmark，定位是便于快速迭代的高信号任务集。CLM 论文按 TerminalBench 2.1 的方式设置轮数、时限和评分。

## TerminalBench

评测 agent 在终端环境中完成任务的 benchmark，也写作 Terminal-Bench。每个任务在容器里运行，agent 通过命令行操作，由任务附带的测试脚本判定是否完成。
