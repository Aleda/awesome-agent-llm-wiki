# A-MEM: Agentic Memory for LLM Agents

## §1 Introduction
## §2 Related Work
## §2.1 Memory for LLM Agents
## §2.2 Retrieval-Augmented Generation
## §3 Methodolodgy
## §3.1 Note Construction
## §3.2 Link Generation
## §3.3 Memory Evolution
## §3.4 Retrieve Relative Memory
## §4 Experiment
## §4.1 Dataset and Evaluation
## §4.2 Implementation Details
## §4.3 Empricial Results
## §4.4 Ablation Study
## §4.5 Hyperparameter Analysis
## §4.6 Scaling Analysis
## §4.7 Memory Analysis
## §5 Conclusions
## §6 Limitations
- Fig. 1 — Traditional memory systems require predefined memory access patterns specified in the workflow, limiting their
- Fig. 2 — Our A-Mem architecture comprises three integral parts in memory storage.
- Tab. 1 — Experimental results on LoCoMo dataset of QA tasks across five categories (Multi Hop, Temporal, Open Domain, Single
- Tab. 2 — Comparison of different memory mechanisms across multiple evaluation metrics on DialSim
- Tab. 3 — An ablation study was conducted to evaluate our proposed method against the GPT-4o-mini base model.
- Fig. 3 — Impact of memory retrieval parameter k across different task categories with GPT-4o-mini as the base model.
- Tab. 4 — Comparison of memory usage and retrieval time across different memory methods and scales.
- Fig. 4 — T-SNE Visualization of Memory Embeddings Showing More Organized Distribution with A-Mem (blue) Compared to Base Memory
- Tab. 5 — Experimental results on LoCoMo dataset of QA tasks across five categories (Multi Hop, Temporal, Open Domain, Single
- Tab. 6 — Experimental results on LoCoMo dataset of QA tasks across five categories (Multi Hop, Temporal, Open Domain, Single
- Tab. 7 — Experimental results on LoCoMo dataset of QA tasks across five categories (Multi Hop, Temporal, Open Domain, Single
- Fig. 5 — T-SNE Visualization of Memory Embeddings Showing More Organized Distribution with A-Mem (blue) Compared to Base Memory
- Tab. 8 — Selection of k values in retriever across specific categories and model choices.
- §1¶2: "These systems require agent developers to predefine memory storage structures, specify storage points within the workflow, and establish retrieval timing."
- §1¶3: "a sophisticated knowledge management system that creates interconnected information networks through atomic notes and flexible linking mechanisms."
- §1¶5: "Memory evolution enables existing memories to dynamically adapt as new experiences are analyzed, leading to the emergence of higher-order patterns and attributes."
- §2.1¶1: "leverages cache-like architectures to prioritize recent information."
- §2.2¶2: "This fundamental distinction in agency between retrieval versus storage and evolution distinguishes our approach from agentic RAG systems, which maintain static knowledge bases despite their sophisticated retrieval mechanisms."
- §3.1¶1: "Building upon the Zettelkasten method’s principles of atomic note-taking and flexible organization, we introduce an LLM-driven approach to memory note construction."
- §3.2¶1: "Based on these candidate nearest memories, we prompt the LLM to analyze potential connections based on their potential common attributes."
- §3.3¶1: "This evolutionary approach enables continuous updates and new connections, mimicking human learning processes."
- §3.4¶1: "These retrieved memories provide relevant historical context that helps the agent better understand and respond to the current interaction."
- §4.1¶1: "LoCoMo features much longer conversations averaging 9K tokens spanning up to 35 sessions"
- §4.2¶1: "while adjusting this parameter for specific categories to optimize performance."
- §4.3¶1: "For GPT-based models, while LoCoMo and MemGPT show strong performance in certain categories like Open Domain and Adversial tasks due to their robust pre-trained knowledge in simple fact retrieval, our A-Mem demonstrates superior performance in Multi-Hop tasks achieves at least two times better performance that require complex reasoning chains."
- §4.3¶2: "The system requires approximately 1,200 tokens per memory operation, achieving an 85-93% reduction in token usage compared to baseline methods (LoCoMo and MemGPT with 16,900 tokens) through our selective top-k retrieval mechanism."
- §4.4¶1: "These results reveal that while the link generation module serves as a critical foundation for memory organization, the memory evolution module provides essential refinements to the memory structure."
- §4.6¶1: "In terms of space complexity, all three systems exhibit identical linear memory usage scaling"
- §6¶1: "First, although our system dynamically organizes memories, the quality of these organizations may still be influenced by the inherent capabilities of the underlying language models."
- §3¶1: "implementing a dynamic and self-evolving memory system that enables LLM agents to maintain long-term memory without predetermined operations."
- §4.1¶2: "Also, we report the average token length for answering one question."
