# Context Language Models

## §1 Introduction
## §2 Related Work
## §3 Pilot Study with ContextBench: A Diagnostic for Context Management
## §4 Context Language Models (CLMs)
## §4.1 Formal Definition and Implementation with Context as a File
## §4.2 In-Context Learning and Reinforcement Learning for CLMs
## §4.3 (More) Efficient CLM Serving with Suffix Cache Reuse
## §5 Results
## §5.1.1 Coding and Deep Research Tasks
## §5.1.2 Open Discovery Problems
## §5.3 (More) Efficient Serving with Suffix Cache Reuse
## §6 Discussion and Future Work
- Fig. 1 — Context Language Models (CLMs) natively manage their own context by treating context as a file.
- Fig. 2 — Illustration of the four tasks in ContextBench and a performance comparison of CLM against baselines using GPT-5.
- Fig. 3 — Qualitative examples of CLM context-management behaviors.
- Fig. 4 — Comparison of standard serving and Suffix Cache Reuse (SCR).
- Fig. 5 — CLMs perform better than action-based and harness-defined baselines at lower cost on coding and deep research tasks.
- Fig. 6 — EdgeBench-10 single-repository optimization.
- Fig. 7 — Software World multi-repository optimization.
- Fig. 8 — CLMs outperform Codex-style summary harness on long-horizon repository optimization. ( \subref fig:
- Fig. 9 — One sentence in the prompt changes the context-management policy.
- Fig. 10 — Textual evolution for CLMs on KV Store (32K budget). Assisted evolution uses Qwen3.6-27B with Claude Fable 5.
- Fig. 11 — Comparison of Suffix Cache Reuse and standard SGLang serving on BCP with Qwen3.6-27B. Left :
- Fig. 12 — Suffix Cache Reuse for full attention layers and linear attention layers.
- Fig. 13 — Small-scale sensitivity study of relocated spans per edit, K. Results on 64 BrowseComp-Plus questions with Qwen3.6-27B.
- Fig. 14 — Suffix Cache Reuse also benefits standard chat serving.
- Fig. 15 — Remaining re-prefill under Suffix Cache Reuse on BrowseComp-Plus.
- Fig. 16 — FLOPs of one Qwen3.
- Fig. 17 — Context pressure of every ContextBench level. Each row varies one generator setting (unit at right);
- Fig. 18 — Operations as the agent receives them, from the smallest level of each task, shortened where marked.
- Fig. 19 — Qwen3.5-9B and Qwen3.6-27B. Accuracy against compute for Qwen3.5-9B (top) and Qwen3.
- Fig. 20 — Circle packing (\uparrow).
- Fig. 21 — Min-max/min-dist (\uparrow).
- Fig. 22 — Erdős min-overlap (\downarrow).
- Fig. 23 — Heilbronn triangle (\uparrow).
- Fig. 24 — Best-so-far score versus evaluator-scored attempts on four open optimization problems. All runs use Claude 4.
- Fig. 25 — Score against time.
- Fig. 26 — Score against compute.
- Fig. 27 — EdgeBench-10 single-repository optimization with a 128K context budget. Qwen3.6-27B, ten tasks, three seeds.
- Fig. 28 — Evolving context-management skills on ContextBench (32K budget), all four tasks. Assisted evolution (top): Qwen3.
- Fig. 29 — RL training curves. Qwen3.
- Fig. 30 — Context length awareness.
## §5.1 Evaluating CLMs Zero-Shot on Long-Horizon Agentic Tasks
## §5.2 Learning Better Context-Management Strategies in Context or in Weights
- Tab. 1 — CLMs outperform specialized OpenEvolve evolutionary workflows on mathematical optimization problems.
- Tab. 2 — RL results on BrowseComp-Plus with Qwen3.5-9B.
- §1¶1: "In contrast, we show that giving LMs unrestricted access to manage their own context outperforms human-designed baselines, enabling adaptive and creative context-management strategies to emerge."
- §1¶7: "In addition, CLMs can evolve an in-context skill document that captures useful context-management procedures for future reuse, improving held-out accuracy on ContextBench by up to 35.9 points at lower compute."
- §2¶1: "Across this progression, model autonomy increases but remains restricted to a human-defined action space."
- §2¶2: "However, RLMs do not address how the live context itself should be managed."
- §3¶3: "As a result, none of the existing methods performs perfectly even on these simple tasks."
- §4.1¶3: "When the LM does not edit the context file, the generated tokens are appended to the existing context by default."
- §4.1¶4: "an agent swarm can be implemented by initializing the workspace with multiple context files, while subagents can be initialized and terminated by creating and deleting additional context files."
- §4.1¶5: "For multi-agent orchestration, CLM maintains an in-context scoreboard and updates agent status through 163 in-place edits while keeping the context at only 6–8K tokens"
- §4.1¶6: "To account for this, we measure theoretical inference FLOPs using a metric we call prefix-reuse FLOPs"
- §4.2¶3: "In each round, the agent produces rollouts on the training split, and a proposer model uses the resulting traces to generate candidate skills."
- §4.2¶5: "Outcome rewards provide only weak supervision for context editing, as successful trajectories can contain inefficient edits and failed trajectories useful ones."
- §4.2¶6: "Thus, the efficiency signal only re-ranks among successful trajectories by inference cost."
- §4.3¶1: "Surviving suffix tokens C thus retain stale cache states that encode the previous prefix, which can even be beneficial in some cases, as it retains richer information from the past."
- §5.1.1¶3: "On BCP, CLMs outperform all baselines, scoring 59.4% at a 32K context limit and exceeding the strongest baseline, Codex-style summarization, by 11.4% relative. CLMs also use 21.5% and 28.9% fewer prefix-reuse FLOPs than the next two strongest methods, Codex-style summarization and MEM1, respectively. On coding benchmarks, CLMs match the strongest baseline, Codex-style summarization, on TB2.1 while using only 70% of its prefix-reuse FLOPs, and exceed it on TBLite (73.7% against 67.0%) with 91% of its FLOPs."
- §5.1.2¶2: "This shows that a general agent with direct context control can outperform a specialized evolutionary workflow with less fixed orchestration."
- §5.1.2¶3: "With Qwen3.6-27B, CLM reaches 44.6 using 179 prefix-reuse PFLOPs per trial, versus 42.3 and 437 PFLOPs for summarization; the subagent variant reaches 44.2 at 181 PFLOPs. With Claude 4.6 Sonnet, CLM and its subagent variant reach 51.0 and 50.4, compared with 42.3 for summarization. We find that subagents provide little additional benefit on this single-repository benchmark."
- §5.1.2¶4: "Compared with a summary-based agent swarm at the same spend, CLM achieves 65% greater downstream speedup over the initial releases"
- §5.2¶2: "Each behavior is induced by a single sentence appended to the task prompt."
- §5.2¶4: "Before training, CLM with Qwen3.5-9B underperforms the summary harness by six points due to the smaller model’s limited context-management capabilities. After RL, it gains 13.7 points to 42.5%, matching the trained summary harness while using 1.34 versus 2.19 PFLOPs per question."
- §5.3¶1: "SCR effectively reduces cache re-prefilling, matching the standard SGLang serving with 65.0% of its empirical prefix-reuse FLOPs on BCP."
- §6¶1: "Editable context can become another channel through which prompt injections or self-generated instructions persist across turns."
- §6¶2: "Since many harness operations can be expressed as context transformations, they can potentially be translated into CLM actions and eventually internalized into model weights."
- §1¶6: "In addition, CLMs can evolve an in-context skill document that captures useful context-management procedures for future reuse, improving held-out accuracy on ContextBench by up to 35.9 points at lower compute. For training, we introduce a success-gated efficiency advantage in stepwise GRPO ( Shao et al., 2024 ) that rewards efficient CLM trajectories among successful ones. Training Qwen3.5-9B on deep research tasks in this manner improves CLM from 28.8% to 42.5% on BrowseComp-Plus, outperforming a Codex-style summary harness trained with the same recipe by 0.4 points while using 38.8% fewer FLOPs."
- §3¶2: "As a result, none of the existing methods performs perfectly even on these simple tasks."
- §4.1¶2: "When the LM does not edit the context file, the generated tokens are appended to the existing context by default."
- §4.1¶3: "an agent swarm can be implemented by initializing the workspace with multiple context files, while subagents can be initialized and terminated by creating and deleting additional context files."
- §4.1¶4: "For multi-agent orchestration, CLM maintains an in-context scoreboard and updates agent status through 163 in-place edits while keeping the context at only 6–8K tokens"
- §4.1¶5: "To account for this, we measure theoretical inference FLOPs using a metric we call prefix-reuse FLOPs"
- §4.2¶4: "In each round, the agent produces rollouts on the training split, and a proposer model uses the resulting traces to generate candidate skills."
- §4.2¶6: "Outcome rewards provide only weak supervision for context editing, as successful trajectories can contain inefficient edits and failed trajectories useful ones. Simply rewarding edit frequency or removed context volume is also undesirable, as the LM may reward-hack by making unnecessary edits that discard important information or hurt prefix reuse. We therefore introduce a success-gated efficiency advantage that further rewards successful trajectories with lower prefix-reuse FLOPs."
- §5.1.1¶2: "On BCP, CLMs outperform all baselines, scoring 59.4% at a 32K context limit and exceeding the strongest baseline, Codex-style summarization, by 11.4% relative. CLMs also use 21.5% and 28.9% fewer prefix-reuse FLOPs than the next two strongest methods, Codex-style summarization and MEM1, respectively. On coding benchmarks, CLMs match the strongest baseline, Codex-style summarization, on TB2.1 while using only 70% of its prefix-reuse FLOPs, and exceed it on TBLite (73.7% against 67.0%) with 91% of its FLOPs."
