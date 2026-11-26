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

## CORE-Bench

评测 agent 计算复现能力的 benchmark（Computational Reproducibility Agent Benchmark）：给定已发表论文附带的代码和数据，agent 要配好环境、跑通代码，并回答关于运行结果的问题。

## GRPO

Group Relative Policy Optimization，DeepSeekMath（2024）提出的强化学习算法。对同一个提示采样一组回答，用组内奖励的相对高低估计优势，因此不需要单独训练价值模型（critic）。

## OpenEvolve

DeepMind AlphaEvolve 的开源实现：LLM 反复提出程序改动，评测函数给每个候选程序打分，按进化算法保留和组合得分更高的版本。

## SGLang

开源的 LLM 推理服务框架。它的 RadixAttention 用基数树管理 KV cache，让共享前缀的请求复用已算好的缓存。

## SWE-bench

Princeton 团队 2023 年发布的软件工程 benchmark，任务取自真实 GitHub 仓库的 issue：模型要生成代码补丁，用仓库自带的测试判定是否解决。SWE-bench Verified 是经人工核验的 500 题子集。

## TerminalBench

评测 agent 在终端环境中完成任务的 benchmark，也写作 Terminal-Bench。每个任务在容器里运行，agent 通过命令行操作，由任务附带的测试脚本判定是否完成。
