# Toolformer: Language Models Can Teach Themselves to Use Tools

## §1 Introduction
## §2 Approach
## §3 Tools
## §4 Experiments
## §4.1 Experimental Setup
## §4.2 Downstream Tasks
## §4.2.1 LAMA
## §4.2.2 Math Datasets
## §4.2.3 Question Answering
## §4.2.4 Multilingual Question Answering
## §4.2.5 Temporal Datasets
## §4.3 Language Modeling
## §4.4 Scaling Laws
## §5 Analysis
## §6 Related Work
## §7 Limitations
## §8 Conclusion
- Fig. 1 — Exemplary predictions of Toolformer. The model autonomously decides to call different APIs (from top to bottom:
- Fig. 2 — Key steps in our approach, illustrated for a question answering tool:
- Fig. 3 — An exemplary prompt P(\mathbf{x}) used to generate API calls for the question answering tool.
- Fig. 4 — Average performance on LAMA, our math benchmarks and our QA benchmarks for GPT-2 models of different sizes and GPT-J
- Tab. 1 — Examples of inputs and outputs for all APIs used.
- Tab. 2 — Number of examples with API calls in \mathcal{C}^{*} for different values of our filtering threshold \tau_{f}.
- Tab. 3 — Results on subsets of LAMA.
- Tab. 4 — Results for various benchmarks requiring mathematical reasoning.
- Tab. 5 — Results for various question answering dataset.
- Tab. 6 — Results on MLQA for Spanish (Es), German (De), Hindi (Hi), Vietnamese (Vi), Chinese (Zh) and Arabic (Ar).
- Tab. 7 — Results for the temporal datasets.
- Tab. 8 — Perplexities of different models on WikiText and our validation subset of CCNet.
- Tab. 9 — Toolformer results on the T-REx subset of LAMA and on WebQS for different values of k used during decoding.
- Tab. 10 — Examples of API calls for different tools, sorted by the value of L_{i}^{-}\,{-}\,L_{i}^{+} that is used as a filtering
- Tab. 11 — Templates used to create Dateset where a current_date is randomly selected.
- §1¶1: "an inability to access up-to-date information on recent events"
- §1¶2: "existing approaches either rely on large amounts of human annotations"
- §1¶2: "what humans find useful may be different from what a model finds useful"
- §1¶3: "we let a LM annotate a huge language modeling dataset with potential API calls"
- §1¶4: "we can apply it to the exact same dataset that was used to pretrain a model in the first place"
- §2¶2: "This enables our approach to work without modifying the existing LM’s vocabulary"
- §2¶4: "that encourages the LM to annotate an example"
- §2¶7: "compared to not receiving the API call at all, or receiving only its input"
- §2¶8: "enables the language model to decide when and how to use which tool, based purely on its own feedback"
- §2¶9: "we interrupt the decoding process, call the appropriate API to get a response"
- §3¶1: "a question answering system, a Wikipedia search engine, a calculator, a calendar, and a machine translation system"
- §3¶2: "a retrieval-augmented LM finetuned on Natural Questions"
- §3¶4: "we use a BM25 retriever"
- §3¶5: "we use the 600M parameter NLLB"
- §3¶6: "a calendar API that, when queried, returns the current date without taking any input"
- §4.1¶1: "to make sure that API calls happen close to where the information provided by the API is actually helpful for the model"
- §4.1¶1: "we only consider texts for the calculator tool if they contain at least three numbers"
- §4.1¶4: "We use the original davinci variant that is not finetuned on any instructions"
- §4.2.1¶1: "we prevent Toolformer from using the Wikipedia Search API to avoid giving it an unfair advantage"
- §4.2.1¶1: "simply check whether the correct word is within the first five words predicted by the model"
- §4.2.1¶2: "the model independently decides to ask the question answering tool for the required information in almost all cases (98.1%)"
- §4.2.2¶1: "we simply check for the first number predicted by the model"
- §4.2.2¶2: "for 97.9% of all examples the model decides to ask the calculator tool for help"
- §4.2.3¶1: "we check whether the first 20 words predicted by a model contain the correct answer"
- §4.2.3¶2: "mostly relying on the Wikipedia search API (99.3%)"
- §4.2.3¶2: "the inability of Toolformer to interact with it, e.g., by reformulating its query if results are not helpful or by browsing through multiple of the top results"
- §4.2.4¶2: "for some languages, finetuning on CCNet deteriorates performance"
- §4.2.5¶1: "Critically, knowing the current date is required to answer these questions"
- §4.2.5¶2: "which is only used for 0.2% of all examples"
- §4.2¶1: "whether Toolformer works in precisely those cases where a user does not specify in advance which tools should be used in which way"
- §4.2¶2: "we only at most one API call per input to make sure the model does not get stuck in a loop"
- §4.4¶2: "the ability to leverage the provided tools only emerges at around 775M parameters"
- §5¶1: "However, this calibration is lost for higher values of k"
- §5¶1: "from 40.3% and 8.5% with k=1"
- §6¶2: "they work by prompting the language model in a few-shot setup tailored towards a specific task where it is known a priori which tools needs to be used"
- §6¶2: "Perhaps most closely related to our work is TALM"
- §6¶3: "Toolformer is trained on its own predictions after applying a perplexity-based filtering step"
- §7¶1: "Toolformer currently does not take into account the tool-dependent, computational cost incurred from making an API call"
- §7¶1: "processing more than a million documents results in only a few thousand examples of useful calls to the calculator API"
- §7¶1: "One such limitation is the inability of Toolformer to use tools in a chain"
