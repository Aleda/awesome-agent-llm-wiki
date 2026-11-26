# Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models

## §1 Introduction
## §2 Background and Motivation
## §2.1 Context Adaptation
## §2.2 Limitations of Existing Context Adaptation Methods
## §3 Agentic Context Engineering (ACE)
## §3.1 Incremental Delta Updates
## §3.2 Grow-and-Refine
## §4 Results
## §4.1 Tasks and Datasets
## §4.2 Baselines and Methods
## §4.3 Results on Agent Benchmark
## §4.4 Results on Domain-Specific Benchmark
## §4.5 Generalization across LLMs
## §4.6 Ablation Study and Sensitivity Analysis
## §4.7 Cost and Speed Analysis
## §5 Discussion
- Fig. 1 — Overall Performance Results.
- Fig. 2 — Context Collapse.
- Fig. 3 — Example ACE-Generated Context on the AppWorld Benchmark (partially shown).
- Fig. 4 — The ACE Framework. Inspired by Dynamic Cheatsheet, ACE adopts an agentic architecture with three specialized components:
- Fig. 5 — The AppWorld leaderboard as accessed on 09/2025.
- Fig. 6 — ICL-baseline Generator prompt on AppWorld
- Fig. 7 — Dynamic Cheatsheet Generator prompt on AppWorld
- Fig. 8 — GEPA prompt on AppWorld
- Fig. 9 — ACE Generator prompt on AppWorld
- Fig. 10 — ACE Reflector prompt on AppWorld
- Fig. 11 — ACE Curator prompt on AppWorld
- Fig. 12 — ACE Generator prompt on FINER
- Fig. 13 — ACE Reflector prompt on FINER
- Fig. 14 — ACE Curator prompt on FINER
- Tab. 1 — Results on the AppWorld Agent Benchmark (DeepSeek-V3.1-671B as the Base LLM).
- Tab. 2 — Results on Financial Analysis Benchmark (DeepSeek-V3.1-671B as the Base LLM).
- Tab. 3 — Ablation Studies on AppWorld.
- Tab. 4 — Cost and Speed Analysis.
- Tab. 5 — Results on the AppWorld Agent Benchmark (GPT-OSS-120B as the Base LLM).
- Tab. 6 — Results on the AppWorld Agent Benchmark (GPT-5.1 as the Base LLM).
- Tab. 7 — Results on Financial Analysis Benchmark (GPT-OSS-120B as the Base LLM).
- Tab. 8 — Results on Financial Analysis Benchmark (GPT-5.1 as the Base LLM).
- Tab. 9 — Results on Financial Analysis Benchmark (Llama-3.3-70B-Instruct as the Base LLM).
- Tab. 10 — Results on Medical Reasoning Benchmark (DeepSeek-V3.1-671B as the Base LLM). We use DDXPlus from StreamBench.
- Tab. 11 — Results on Text-to-SQL Benchmark (DeepSeek-V3.1-671B as the Base LLM). We use BIRD-SQL from StreamBench.
- Tab. 12 — Adaptation-Stage Aggregate Cost Statistics on AppWorld. The percentages compare ACE (total) against GEPA (total).
- Tab. 13 — Adaptation-Stage Average Cost Statistics on AppWorld. The percentages compare ACE (total) against GEPA (total).
- Tab. 14 — Evaluation-Stage Aggregate Cost Statistics on AppWorld. The percentages compare ACE against GEPA.
- Tab. 15 — Evaluation-Stage Average Cost Statistics on AppWorld. The percentages compare ACE against GEPA.
- Tab. 16 — Weaker Reflector Models on FiNER. We vary the Reflector while keeping the Generator/Curator fixed.
- Tab. 17 — Robustness to Noisy or Harmful Reflector Feedback on FiNER. We invoke a harmful reflector once every X adaptation steps.
- Tab. 18 — Ablation on Incremental Context Updates (AppWorld, DeepSeek-V3.1).
- Tab. 19 — Effect of Reflection Iterations (AppWorld, DeepSeek-V3.1).
- Tab. 20 — Effect of Deduplication Threshold (FiNER, DeepSeek-V3.1).
- Tab. 21 — Effect of Pruning Trigger (FiNER, DeepSeek-V3.1).
- §1¶1: "Instead of modifying model weights, context adaptation improves performance after model training by incorporating clarified instructions, structured reasoning steps, or domain-specific input formats directly into the model’s inputs."
- §1¶3: "many prompt optimizers prioritize concise applicable instructions over comprehensive accumulation"
- §1¶3: "methods that rely on monolithic rewriting by an LLM often degrade into shorter, less informative summaries over time"
- §1¶4: "Unlike humans, who often benefit from concise generalization, LLMs are more effective when provided with long, detailed contexts and can distill relevance autonomously"
- §1¶4: "contexts should preserve them, allowing the model to decide what matters during inference time"
- §1¶6: "ACE surpasses the top-1-ranked production-level agent IBM-CUGA"
- §2.1¶1: "which constructs an external memory that accumulates strategies and lessons from past successes and failures during inference"
- §2.1¶1: "which reflects on failures to improve agent planning"
- §2.2¶1: "the tendency of optimization to collapse toward short, generic prompts"
- §2.2¶2: "at step 60 the context contained 18,282 tokens and achieved an accuracy of 66.7, but at the very next step it collapsed to just 122 tokens, with accuracy dropping to 57.1—worse than the baseline accuracy of 63.7 without adaptation"
- §2.2¶2: "it reflects a fundamental risk of end-to-end context rewriting with LLMs"
- §3¶1: "which distills concrete insights from successes and errors"
- §3¶3: "which are merged deterministically into the existing context by lightweight, non-LLM logic"
- §3¶3: "ACE further supports multi-epoch adaptation, where the same queries are revisited to progressively strengthen the context."
- §3.1¶1: "counters tracking how often it was marked helpful or harmful"
- §3.1¶1: "The concept of a bullet is similar to the concept of a memory entry in LLM memory frameworks like Dynamic Cheatsheet"
- §3.1¶1: "A core design principle of ACE is to represent context as a collection of structured, itemized bullets , rather than a single monolithic prompt."
- §3.1¶3: "This avoids the computational cost and latency of full rewrites, while ensuring that past knowledge is preserved and new insights are steadily appended."
- §3.2¶1: "A de-duplication step then prunes redundancy by comparing bullets via semantic embeddings."
- §3.2¶1: "This refinement can be performed proactively (after each delta) or lazily (only when the context window is exceeded)"
- §4.1¶2: "the best system achieved only 60.3% average accuracy"
- §4.1¶4: "for each sample, the model first predicts with the current context, then updates its context based on that sample"
- §4.2¶5: "set it to use the cumulative mode (DC-CU)"
- §4.2¶6: "We adopt a batch size of 1 (constructing a delta context from each sample)."
- §4.2¶6: "we use the same LLM for the Generator, Reflector, and Curator"
- §4.3¶1: "ReAct + ACE outperforms both ReAct + ICL and ReAct + GEPA by significant margins (12.3% and 11.9%, respectively)"
- §4.3¶2: "ReAct + ACE achieves an average improvement of 14.8% over the ReAct baseline in this setting"
- §4.3¶3: "ReAct + ACE even surpasses IBM CUGA by 8.4% in TGC and 0.7% in SGC on test-challenge"
- §4.3¶3: "It is not used as a methodological baseline, and we do not make direct comparisons."
- §4.3¶3: "ReAct + ACE (59.4% average) matches the top-1-ranked IBM CUGA (60.3%)"
- §4.4¶2: "the constructed context can be polluted by spurious or misleading signals"
- §4.4¶2: "when ground-truth supervision or reliable execution signals are absent, both ACE and DC may degrade in performance"
- §4.6¶2: "it remains effective with a much weaker Reflector and shows only modest additional gains from stronger reflectors"
- §4.7¶2: "ACE achieves 82.3% reduction in adaptation latency and 75.1% reduction in the number of rollouts as compared to GEPA"
- §4.7¶3: "while ACE may use more raw input tokens due to a richer playbook"
- §4.7¶4: "91.8% of input tokens are served from cache during evaluation stage, which reduces billed input-token cost by 82.6% relative to counting raw context tokens"
- §5¶1: "because contexts are human-interpretable, ACE enables selective unlearning"
- §5¶2: "often benefit more from concise, high-level instructions"
- §5¶2: "A limitation of ACE is its reliance on a reasonably strong Reflector"
- §3¶2: "a dedicated Reflector that separates evaluation and insight extraction from curation"
- §3.1¶2: "so only the relevant bullets are updated"
- §4.1¶1: "with ACE, agents can accumulate and reuse strategies across episodes and environments"
- §2.2¶2: "at step 60 the context contained 18,282 tokens and achieved an accuracy of 66.7, but at the very next step it collapsed to just 122 tokens, with accuracy dropping to 57.1—worse than the baseline accuracy of 63.7 without adaptation"
- §5¶1: "ACE offers a flexible and efficient alternative to conventional model fine-tuning"
