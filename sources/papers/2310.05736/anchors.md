# LLMLingua: Compressing Prompts for Accelerated Inference of Large Language Models

## §1 Introduction
## §2 Related Work
## §2.1 Efficient LLMs
## §2.2 Out-of-Distribution (OoD) Detection
## §2.3 LLMs as a Compressor
## §3 Problem Formulation
## §4 Methodology
## §4.1 Budget Controller
## §4.2 Iterative Token-level Prompt Compression
## §4.3 Distribution Alignment
## §5 Experiments
## §5.1 Settings
## §5.2 Main Results
## §5.3 Analysis on Reasoning & ICL Tasks
## §5.4 Ablation
## §5.5 Discussion
## §6 Conclusion
- Fig. 1 — Framework of the proposed approach LLMLingua .
- Fig. 2 — The distribution of generated token lengths at varying compression ratios (1/\tau).
- Fig. 3 — The performance of various prompt compression methods at different compression ratios (1/\tau) on GSM8K.
- Fig. 4 — Recovering the compressed prompt(1/\tau=17x, Alpaca-7B as small language model) from GSM8K using GPT-4.
- Fig. 5 — Recovering the compressed prompt (1/\tau=19x, GPT2-Alpaca as small language model) from GSM8K using GPT-4.
- Fig. 6 — Recovering the compressed prompt(1/\tau=7x, Alpaca-7B as small language model) from BBH using GPT-4.
- Fig. 7 — Cases study on GSM8K math reasoning dataset in half-shot constraint.
- Fig. 8 — Cases study on web_of_lies of BBH reasoning dataset in quarter-shot constraint.
- Fig. 9 — Cases study on ShareGPT conversation dataset in 2x constraint.
- Fig. 10 — Cases study on Arxiv-March23 summarization dataset in 200 tokens constraint.
- Tab. 1 — Performance of different methods under different target compression ratios on the conversation (ShareGPT) and
- Tab. 2 — Performance of different methods under different target compression ratios on the GSM8K mathematical reasoning and
- Tab. 3 — Ablation study on GSM8K in 1-shot constraint.
- Tab. 4 — Ours method on GSM8K using Claude-v1.3.
- Tab. 5 — Our method on GSM8K with GPT2-Alpaca as the small language model.
- Tab. 6 — Latency (s) comparison on GSM8K.
- Tab. 7 — The inference costs($) for various datasets using GPT-3.5-Turbo.
- §1¶1: "these approaches may be not suitable when the LLMs can be accessed via APIs only"
- §1¶2: "These approaches are grounded in the concept that natural language is inherently redundant"
- §1¶3: "removing tokens with lower perplexity has a relatively minor impact on the LLM’s comprehension of the context"
- §1¶3: "this method not only ignores the interdependence between the compressed contents but also neglects the correspondence between the LLM being targeted and the small language model used for prompt compression"
- §2.1¶2: "these approaches require multiple invocations of LLMs, which are quite costly"
- §2.1¶2: "learning special tokens via prompt tuning of LLMs to reduce the number of tokens to be processed during inference"
- §2.1¶4: "This paper is inspired by Selective-Context and further proposes a coarse-to-fine framework to address its limitations."
- §2.2¶2: "we consider tokens with higher perplexity to be more influential during the inference process of language models"
- §4.1¶2: "the instruction and the question in a prompt have a direct influence on the generated results"
- §4.1¶3: "When a high compression ratio is required, token-level dropout as in Li (2023) might make the compressed prompts too trivial and thus lose vital information from the original prompt."
- §4.1¶7: "we select demonstrations in descending order of their perplexity values"
- §4.2¶3: "The compressed prompt obtained from each segment is concatenated to the subsequent segment, enabling more accurate estimation of the conditional probability."
- §4.3¶1: "To narrow the gap between the distribution of the LLM and that of the small language model used for prompt compression, here we align the two distributions via instruction tuning."
- §5.1¶3: "The segment size used in the iterative token-level compression is set to 100."
- §5.2¶2: "on GSM8K, the EM scores will decrease by 1.44 and 1.52, respectively, despite compression ratios as high as 14x and 20x"
- §5.3¶2: "the suboptimal performance on prompt compression indicates that the generated prompts may omit crucial details from the original prompt, particularly reasoning steps"
- §5.3¶3: "Compared to the zero-shot results, our approach exhibits significant performance improvements of 51.55 and 24.53 even with the largest compression ratios."
- §5.4¶2: "resulting in a further improvement of 0.56 on GSM8K"
- §5.5¶1: "our method can achieve improvements over the simple prompt by 0.8 and 1.7 EM points with compression ratios of 5x and 14x, respectively"
- §5.5¶2: "This is due to the significant distribution discrepancy between the small LM and the target LLM."
- §5.5¶4: "prompt compression not only saves computational resources in the input but also contributes to computational savings in the generation stage"
- §5.5¶6: "we can achieve nearly 4x savings in computational resources when using the smaller LM with a prompt compression rate of 5x"
- §5.5¶7: "LLMLingua has a relatively small computation overhead and can achieve a speedup ranging from 1.7x to 5.7x"
- §5.5¶8: "GPT-3.5-Turbo struggles to reconstruct compressed prompts, while GPT-4 has demonstrated an ability to do so"
- §5.5¶8: "It is evident that LLMs can effectively comprehend the semantic information in the compressed prompts, even if it might be challenging for humans."
- §5.5¶9: "The content and length of the generated text are uncontrollable."
- §6¶1: "which is based on the small LM’s PPL for black-box LLMs"
- §3¶1: "A prompt compression system is designed to generate a compressed prompt"
- §4.2¶2: "Here we propose an iterative token-level prompt compression (ITPC) algorithm to mitigate the inaccuracy introduced by the conditional independence assumption."
- §4.2¶5: "Finally, tokens in each \bm{s}_{j} with the PPL greater than \gamma_{j} are retained in the compressed prompt."
- §5.1¶1: "we evaluated their performance across four datasets"
