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
