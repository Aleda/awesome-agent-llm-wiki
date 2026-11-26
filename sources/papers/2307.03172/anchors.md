# Lost in the Middle: How Language Models Use Long Contexts

## §1 Introduction
## §2 Multi-Document Question Answering
## §2.1 Experimental Setup
## §2.2 Models
## §2.3 Results and Discussion
## §3 How Well Can Language Models Retrieve From Input Contexts?
## §3.1 Experimental Setup
## §3.2 Results and Discussion
## §4 Why Are Language Models Not Robust to Changes in the Position of Relevant Information?
## §4.1 Effect of Model Architecture
## §4.2 Effect of Query-Aware Contextualization
## §4.3 Effect of Instruction Fine-Tuning
## §5 Is More Context Is Always Better? A Case Study With Open-Domain QA
## §6 Related Work
## §6.1 Long-Context Language Models
## §6.2 How Do Language Models Use Context?
## §6.3 The Serial-Position Effect
## §7 Conclusion
- Fig. 1 — Changing the location of relevant information (in this case, the position of the passage that answers an input
- Fig. 2 — Example of the multi-document question answering task, with an input context and the desired model answer.
- Fig. 3 — Modulating the position of relevant information within the input context for the multi-document question answering
- Fig. 4 — Modulating the input context length of the multi-document question answering example presented in Figure 2 .
- Fig. 5 — The effect of changing the position of relevant information (document containing the answer) on multi-document question
- Fig. 6 — Example of the key-value retrieval task, with an input context and the desired model output.
- Fig. 7 — The effect of changing the input context length and the position of relevant information on key-value retrieval
- Fig. 8 — When encoder-decoder models (Flan-UL2 and Flan-T5-XXL) evaluated on sequences that are shorter than their encoder’s
- Fig. 9 — Query-aware contextualization (placing the query before and after the documents) does not substantially improve
- Fig. 10 — Multi-document QA performance of MPT-30B-Instruct compared against its base model (i.e.
- Fig. 11 — Retriever recall and model performance as a function of the number of retrieved documents.
- Fig. 12 — Language model performance on a unambiguous subset of questions.
- Fig. 13 — Language model performance on multi-document QA when using random distractors, rather than retrieved distractors.
- Fig. 14 — Language model performance when randomizing the order of the distractors (rather than presenting them in order of
- Fig. 15 — Although GPT-4 has higher absolute performance than other models, its performance still degrades when relevant
- Fig. 16 — Multi-document QA performance (20 total documents) of Llama-2 models of varying sizes (7B, 13B, 70B parameters), with
- Tab. 1 — Closed-book and oracle accuracy of language models on the multi-document question answering task.
- Tab. 2 — Token count statistics for each of the evaluated models on the closed-book and oracle multi-document question answering
- Tab. 3 — Token count statistics for each of the evaluated models on each of the document question answering settings.
- Tab. 4 — Token count statistics for each of the evaluated models on each of the key-value (KV) retrieval settings.
- Tab. 5 — Model performance when evaluated on the multi-document QA task with 10 total retrieved documents.
- Tab. 6 — Model performance when evaluated on the multi-document QA task with 20 total retrieved documents.
- Tab. 7 — Model performance when evaluated on the multi-document QA task with 30 total retrieved documents.
- §1¶2: "it remains unclear how these extended-context language models make use of their input contexts when performing downstream tasks"
- §1¶3: "If language models can robustly use information within long input contexts, then their performance should be minimally affected by the position of the relevant information in the input context."
- §1¶4: "this task mimics the retrieval-augmented generation setup underlying many commercial generative search and question answering applications"
- §1¶5: "language model performance is highest when relevant information occurs at the very beginning (primacy bias) or end of its input context (recency bias), and performance significantly degrades when models must access and use information in the middle of their input context"
- §1¶5: "we observe a distinctive U-shaped performance curve"
- §1¶9: "to claim that a language model can robustly use information within long input contexts, it is necessary to show that its performance is minimally affected by the position of the relevant information in the input context"
- §2.1¶2: "we take the 2655 queries where the annotated long answer is a paragraph"
- §2.1¶3: "Ambiguity in NaturalQuestions-Open means that a small number of distractor passages may contain a reasonable answer."
- §2.1¶3: "In the input context, the distractor documents are presented in order of decreasing relevance."
- §2.1¶5: "judging whether any of the correct answers (as taken from the NaturalQuestions annotations) appear in the predicted output"
- §2.2¶3: "Evaluating GPT-4 on the full multi-document QA and key-value retrieval experiments would cost upwards of $6000."
- §2.3¶2: "in the worst case, performance in 20- and 30-document settings is lower than performance without any input documents (i.e., closed-book performance; 56.1%)."
- §2.3¶3: "These results indicate that extended-context models are not necessarily better than their non-extended counterparts at using their input context."
- §3.1¶2: "we explicitly seek to distill and simplify the task by removing as much natural language semantics as possible (using random UUIDs instead)"
- §3.2¶1: "We experiment with input contexts containing 75, 140, and 300 key-value pairs (500 examples each)."
- §3.2¶2: "Claude-1.3 and Claude-1.3 (100K) do nearly perfectly on all evaluated input context lengths, but other models struggle"
- §3.2¶3: "GPT-3.5-Turbo, GPT-3.5-Turbo (16K), and MPT-30B-Instruct have the lowest performance when they must access key-value pairs in the middle of their input context."
- §4¶1: "we perform some preliminary investigations into the role of model architecture (decoder-only vs. encoder-decoder), query-aware contextualization, and instruction fine-tuning"
- §4.1¶3: "We hypothesize that encoder-decoder models may make better use of their context windows because their bidirectional encoder allows processing each document in the context of future documents"
- §4.1¶3: "its performance is relatively robust to changes in the position of relevant information within the input context (1.9% absolute difference between best- and worst-case performance)"
- §4.2¶2: "all models achieve near-perfect performance on the 75, 140, and 300 key-value pair settings"
- §4.2¶3: "query-aware contextualization minimally affects performance trends in the multi-document question answering task"
- §4.3¶1: "The task specification and/or instruction is commonly placed at the beginning of the input context in supervised instruction fine-tuning data, which might lead instruction fine-tuned language models to place more weight on the start of the input context."
- §4.3¶2: "both MPT-30B and MPT-30B-Instruct exhibit a U-shaped performance curve"
- §4.3¶2: "instruction fine-tuning slightly reduces the worst-case performance disparity from nearly 10% between the base model best- and worst-case performance to around 4%"
- §4.3¶3: "We hypothesize that non-instruction fine-tuned language models learn to use these long contexts from similarly-formatted data that may occur in Internet text seen during pre-training"
- §4.3¶4: "the 7B Llama-2 models are solely recency biased, while the 13B and 70B models exhibit a U-shaped performance curve"
- §5¶3: "effective reranking of retrieved documents (pushing relevant information closer to the start of the input context) or ranked list truncation"
- §5¶3: "Using more than 20 retrieved documents only marginally improves reader performance"
- §6.3¶1: "Observing a serial-position-like effect in language models is perhaps surprising, since the self-attention mechanisms underlying Transformer language models is technically equally capable of retrieving any token from their contexts."
- §6.3¶1: "The U-shaped curve we observe in this work has a connection in psychology known as the serial-position effect"
- §2.1¶1: "exactly one of the documents contains the answer to the question and k-1 “distractor” documents do not"
- §2.1¶4: "To modulate the input context length in this task, we increase or decrease the number of retrieved documents that do not contain the answer"
- §2.2¶2: "We experiment with MPT-30B-Instruct, which has a maximum context length of 8192 tokens."
- §2.3¶1: "We experiment with input contexts containing 10, 20, and 30 total documents."
- §2.3¶1: "In the closed-book setting, models are not given any documents in their input context"
- §5¶2: "We use language models in a standard retriever-reader setup."
