# Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory

## §1 Introduction
## §2 Proposed Methods
## §2.1 Mem0
## §2.2 \texttt{Mem0}^{\tiny g}
## §3 Experimental Setup
## §3.1 Dataset
## §3.2 Evaluation Metrics
## §3.3 Baselines
## §4 Evaluation Results, Analysis and Discussion
## §4.1 Performance Comparison Across Memory-Enabled Systems
## §4.2 Cross-Category Analysis
## §4.3 Performance Comparison of Mem0 and \texttt{Mem0}^{\tiny g} Against RAG Approaches and Full-Context Model
## §4.4 Latency Analysis
## §4.5 Memory System Overhead: Token Analysis and Construction Time
## §5 Conclusion and Future Work
## §6 Acknowledgments
- Fig. 1 — Illustration of memory importance in AI agents.
- Fig. 2 — Architectural overview of the Mem0 system showing extraction and update phase.
- Fig. 3 — Graph-based memory architecture of \texttt{Mem0}^{\tiny g} illustrating entity extraction and update phase.
- Tab. 1 — Performance comparison of memory-enabled systems across different question types in the LOCOMO dataset.
- Tab. 2 — Performance comparison of various baselines with proposed methods.
- Fig. 4 — Latency Analysis of Different Memory Approaches.
- §1¶3: "these improvements merely delay rather than solve the fundamental limitation."
- §1¶4: "Latency measurements further reveal that Mem0 operates with 91% lower response times than full-context approaches"
- §2.1¶2: "The function \phi(P) then extracts a set of salient memories \Omega=\{\omega_{1},\omega_{2},...,\omega_{n}\} specifically from the new exchange while maintaining awareness of the conversation’s broader context"
- §2.1¶3: "The LLM itself determines which of four distinct operations to execute: ADD for creation of new memories when no semantically equivalent memory exists; UPDATE for augmentation of existing memories with complementary information; DELETE for removal of memories contradicted by new information; and NOOP when the candidate fact requires no modification to the knowledge base."
- §2.1¶4: "All language model operations utilized GPT-4o-mini as the inference engine."
- §2.2¶5: "An LLM-based update resolver determines if certain relationships should be obsolete, marking them as invalid rather than physically removing them to enable temporal reasoning."
- §3.1¶1: "It comprises 10 extended conversations, each containing approximately 600 dialogues and 26000 tokens on average, distributed across multiple sessions."
- §3.2¶2: "Due to the stochastic nature of J evaluations, we conducted 10 independent runs for each method on the entire dataset"
- §3.3¶2: "For our evaluation, we select the metrics where gpt-4o-mini was used for the evaluation."
- §3.3¶6: "These generated memories are then used as complete context for answering questions about each conversation, intentionally granting the OpenAI approach privileged access to all memories rather than only question-relevant ones."
- §4.1¶4: "edging out our methods by a narrow margin."
- §4.2¶1: "Surprisingly, the expected relational advantages of \texttt{Mem0}^{\tiny g} do not translate into better outcomes here"
- §4.3¶1: "Even the strongest RAG approach peaks at around 61% in the J metric, whereas Mem0 reaches 67%—about a 10% relative improvement—and \texttt{Mem0}^{\tiny g} reaches over 68%, achieving around a 12% relative gain."
- §4.3¶2: "Despite these improvements, a full-context method that ingests a chunk of roughly 26,000 tokens still achieves the highest J score (approximately 73%)."
- §4.4¶2: "Our proposed Mem0 approach achieves the lowest search latency among all methods (p50: 0.148s, p95: 0.200s)"
- §4.5¶1: "Mem0 encodes complete dialogue turns in a natural language representation and therefore occupies only 7k tokens per conversation on an average."
- §5¶1: "On the LOCOMO benchmark, our methods deliver 5%, 11%, and 7% relative improvements in single-hop, temporal, and multi-hop reasoning question types over best performing methods in respective question type and reduce p95 latency by over 91%"
- §1¶1: "Without memory, AI agents forget user preferences, repeat questions, and contradict previously established facts."
- §2¶1: "memories are stored as directed labeled graphs with entities as nodes and relationships as edges."
- §2.2¶6: "The entity-centric method first identifies key entities within a query"
- §2.2¶7: "as the underlying graph database."
- §4.4¶1: "it requires pre-extraction of relevant context, which is not reflected in the reported metrics."
- §5¶2: "optimizing graph operations to reduce the latency overhead"
