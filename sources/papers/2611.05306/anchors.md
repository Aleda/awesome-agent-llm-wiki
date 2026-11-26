# You don't need long context

## §1 Introduction
## §2 Methodology
## §2.1 Definitions
## §2.2 Benchmarks
## §2.3 Models
## §2.4 Harnesses
## §2.4.1 Accommodations for long conversational context
## §2.4.2 Accommodations for long inputs
## §2.5 Latency and throughput measurement
## §3 Long-horizon tasks don’t need long contexts
## §3.1 Long-horizon tasks may sometimes need the history
## §4 Long-input tasks don’t need long contexts
## §5 Compaction can be performed after every action
## §5.1 Semantic State Space Models (SSSMs)
## §6 Conclusion
- Fig. 1 — The cost of long context.
- Fig. 2 — The burden of long context.
- Fig. 3 — Context-management regimes. The three context-management regimes considered in this work:
- Fig. 4 — Decode throughput collapses as the context window size grows.
- Fig. 5 — Long-horizon results as a function of total context limit. Top:
- Fig. 6 — Long-input results as a function of total context limit. Top:
- Fig. 7 — LongBench v2: conversation length versus document length. Claude Opus 4.5, compaction at 16K / 12K.
- Fig. 8 — LOONG: conversation length versus document length. Claude Opus 4.5, compaction at 48K / 40K (1,600 questions).
- Tab. 2 — SAC versus FHA and EoCC. The mini baseline is the full-history accumulation regime.
- Tab. 3 — SWE-bench Verified. Accuracy is the percentage of instances resolved .
- Tab. 4 — SWE-bench Multilingual. Results for Claude Opus 4.5 High and GPT 5.6 Sol Medium on 300 instances per model.
- Tab. 5 — Terminal-Bench (TB-2.1). Columns and quantities are as in Table 3 ; Accuracy is the percentage of tasks solved.
- Tab. 6 — FRAMES. Columns and quantities are as in Table 3 ; Accuracy is the percentage of questions answered correctly.
- Tab. 7 — BFCLv3 (200 long-context multi-turn episodes). Columns and quantities are as in Table 3 ;
- Tab. 8 — \tau^{2} -bench. Columns and quantities are as in Table 3 .
- Tab. 9 — Open-weight results on SWE-bench Verified. Scores are percentages of 500 instances resolved;
- Tab. 10 — Open-weight results on Terminal-Bench 2.1. Columns are as in Table 9 ; scores are percentages of 89 tasks solved.
- Tab. 11 — LongBench v2. Accuracy is the percentage answered correctly.
- Tab. 12 — LOONG. Columns and quantities are as in Table 11 ; Accuracy (avg / perfect) lists average score / perfect-answer rate.
- Tab. 13 — AA-LCR. Columns and quantities are as in Table 11 .
- Tab. 14 — NIAH. Columns and quantities are as in Table 11 .
- Tab. 15 — RULER. Columns and quantities are as in Table 11 ; Accuracy (recall / exact) lists mean recall / exact-match rate.
- Tab. 16 — Counting-Stars. Columns and quantities are as in Table 11 ; Accuracy (mean / exact) lists mean score / exact-match rate.
- Tab. 17 — BABILong. Columns and quantities are as in Table 11 .
- Tab. 1 — Lengths of literary works against model context window sizes. Word counts use the cited English editions.
- §1¶1: "This fact is often hidden from the end user since retail token prices are quoted at a fixed price per 1M tokens regardless of the input context length."
- §1¶5: "It would seem that models have been evolving to accommodate the ever larger possible inputs rather than to maximize efficiency."
- §1¶6: "And, if there are currently any objective benefits of keeping long context models, we can likely preserve them by making the appropriate post-training adjustments to future models."
- §1¶8: "by storing the long input as a resource and equipping the LM with a tool for selective input reading."
- §3¶4: "More specifically, across all benchmarks and compaction thresholds, the relative performance of Opus 4.5 ranges from -3.7 to +5.6ppts, while the relative performance of GPT 5.6 Sol ranges from -3.3 to +4.4. The ranges are somewhat deceiving when considered by themselves, however: for either model, no more than 5 out of 22 threshold configurations lose more than 2ppts of the baseline. Secondly, observe the multiples of cost savings across all benchmarks, ranging from 2.2x to 8.8x for Opus 4.5 and from 2.4x to 5.0x for GPT 5.6 Sol."
- §3¶5: "Such behavior could result in an increased total token spend per task, ultimately erasing some of the cost savings due to smaller context windows. In our experimentation, this was generally not the case."
- §3.1¶2: "Compaction is a lossy context compression method."
- §3.1¶4: "any such example can be eliminated by creating a harness that keeps a record of every message of any agentic conversation, and makes it readily accessible to the agent by the means of a selective reading tool."
- §3.1¶6: "you don’t need to keep the entire conversational history in the context in order to complete long-horizon tasks"
- §4¶4: "More specifically, across all benchmarks and compaction thresholds, the relative performance of Opus 4.5 ranges from -0.4 to +40.0ppts, while the relative performance of GPT 5.6 Sol ranges from +1.0 to +30.9 (!). Observe also the multiples of cost savings across all benchmarks, ranging from 6.5x to 54.6x for Opus 4.5 and from 4.4x to 233.3x for GPT 5.6 Sol. These represent the estimated cost savings as a consequence of both selective input reading and serving only shorter context window sizes"
- §4¶7: "Thus, the size of a task’s input does not itself establish a need for long context."
- §5¶2: "Meanwhile, across both models and benchmarks, median peak live context under SAC is only 7–9K tokens, and the maximum falls from 130–200K to 15–37K tokens."
- §5¶3: "showing that compaction frequency can be pushed to relative extremes without catastrophic consequences for task accuracy."
- §5.1¶1: "In other words, could not all models potentially be performing single-action compaction (SAC) by default?"
- §5.1¶2: "We propose the notion of a Semantic State Space Model (SSSM). A SSSM is a model post-trained to (1) comprehend an input language description of a state of a conversation"
- §5.1¶3: "We further surmise that it is considerably more data-efficient to train semantic state-space models due to the lack of need to teach the model to pay attention to the suitable patches of earlier context. Ultimately, we see no reason why SSSMs could not match the performance of full-history-accumulating models"
- §6¶2: "we conclude that long contexts are not necessary for the completion of “long-context” tasks."
- §6¶3: "Our evidence does not rule out the existence of tasks for which long context is beneficial, nor does it prove that every possible task can be solved with short context."
