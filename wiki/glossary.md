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

## BrowseComp-Plus

在 OpenAI 的 BrowseComp 基础上构建的深度研究类 benchmark，为问题配了一个固定的文档语料库，agent 只在这个语料库里检索。语料固定后结果可以复现，也能把检索器的效果和 agent 的推理能力分开评估。

## ContextBench

CLM 论文（arXiv 2609.37725）提出的上下文管理诊断 benchmark，含 Needle Retention、Sudoku Sketchpad、KV Store、Log Triage 四个合成任务。任务不需要额外推理或知识，输入总量最高到上下文上限的 24 倍，只测 agent 怎样管理上下文。

## CORE-Bench

评测 agent 计算复现能力的 benchmark（Computational Reproducibility Agent Benchmark）：给定已发表论文附带的代码和数据，agent 要配好环境、跑通代码，并回答关于运行结果的问题。

## EdgeBench

在真实软件仓库里做长时间优化的 benchmark：agent 在无网络的容器里改进一个代码库，由评测器按 0–100 打分。CLM 论文从中选了 10 个任务，称为 EdgeBench-10，每次运行 12 小时。

## GRPO

Group Relative Policy Optimization，DeepSeekMath（2024）提出的强化学习算法。对同一个提示采样一组回答，用组内奖励的相对高低估计优势，因此不需要单独训练价值模型（critic）。

## Heilbronn triangle problem

Heilbronn 三角形问题：在单位区域内放置 n 个点，使任意三点构成的三角形中面积最小的那个尽可能大。AlphaEvolve 和 OpenEvolve 把它用作数学优化测试题。

## OpenEvolve

社区开发的开源框架，仿照 DeepMind 的 AlphaEvolve 实现，并非 DeepMind 官方发布。LLM 反复提出程序改动，评测函数给每个候选程序打分，按进化算法保留得分更高的版本并在其上继续变异。

## prefix-reuse FLOPs

CLM 论文定义的推理成本指标：按带前缀缓存的推理服务计算整条轨迹的理论 FLOPs，包括解码、预填，以及上下文中段被编辑后从第一个不匹配位置起的重预填。

## Qwen

阿里巴巴通义团队发布的开源大模型系列。CLM 论文用到的 Qwen3.6-27B 是混合架构，64 层中 48 层为线性注意力；另一个是 Qwen3.5-9B。

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
