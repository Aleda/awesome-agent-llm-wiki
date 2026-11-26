# MemGPT: Towards LLMs as Operating Systems

## §1 Introduction
## §2 MemGPT (MemoryGPT)
## §2.1 Main context ( prompt tokens )
## §2.2 Queue Manager
## §2.3 Function executor (handling of completion tokens )
## §2.4 Control flow and function chaining
## §3 Experiments
## §3.1 MemGPT for conversational agents
## §3.1.1 Deep memory retrieval task (consistency)
## §3.1.2 Conversation opener task (engagement)
## §3.2 MemGPT for document analysis
## §3.2.1 Multi-document question-answering
## §3.2.2 Nested key-value retrieval (KV)
## §4 Related Work
## §5 Conclusion
## §6 Appendix
## §6.1 Prompts and instructions
## §6.1.1 MemGPT instructions (DMR)
## §6.1.2 LLM Judge (DMR / opener)
## §6.1.3 Self-instruct DMR dataset generation
## §6.1.4 Document Analysis Instructions
## §6.1.5 LLM Judge (document analysis)
## §6.1.6 K/V Task Instructions
- Fig. 1 — MemGPT (left) writes data to persistent memory after it receives a system alert about limited context space.
- Fig. 2 — MemGPT (left) can search out-of-context data to bring relevant information into the current context window.
- Fig. 3 — In MemGPT, a fixed-context LLM processor is augmented with a hierarchical memory system and functions that let it
- Fig. 4 — An example conversation snippet where MemGPT (left) updates stored information.
- Fig. 5 — Document QA task performance. MemGPT’s performance is unaffected by increased context length.
- Fig. 6 — An example of MemGPT (left) solving the document QA task.
- Fig. 7 — Nested KV retrieval task performance.
- Fig. 8 — An example of MemGPT (left) solving the nested KV task (UUIDs shortened for readability).
- Tab. 1 — Comparing context lengths of commonly used models and LLM APIs (data collected 1/2024).
- Tab. 2 — Deep memory retrieval (DMR) performance.
- Tab. 3 — Conversation opener performance.
- §1¶2: "even if we could overcome the computational challenges of context scaling, recent research shows that long-context models struggle to utilize additional context effectively"
- §1¶3: "In this paper, we study how to provide the illusion of an infinite context while continuing to use fixed-context models."
- §1¶5: "To provide a similar illusion of longer context length (analogous to virtual memory), we allow the LLM to manage what is placed in its own context (analogous to physical memory) via an ‘LLM OS’, which we call MemGPT."
- §2¶1: "This out-of-context data must always be explicitly moved into main context in order for it to be passed to the LLM processor during inference."
- §2.1¶1: "Working context is a fixed-size read/write block of unstructured text, writeable only via MemGPT function calls. In conversational settings, working context is intended to be used to store key facts, preferences, and other important information about the user and the persona the agent is adopting"
- §2.2¶2: "When the prompt tokens exceed the ‘warning token count‘ of the underlying LLM’s context window (e.g. 70% of the context window), the queue manager inserts a system message into the queue warning the LLM of an impending queue eviction"
- §2.3¶1: "Memory edits and retrieval are entirely self-directed: MemGPT autonomously updates and searches through its own memory based on the current context."
- §2.3¶2: "Awareness of context limits is a key aspect in making the self-editing mechanism work effectively"
- §2.4¶2: "Function chaining allows MemGPT to execute multiple function calls sequentially before returning control to the user."
- §3.1¶3: "Each multi-session chat in MSC has five total sessions, and each session consists of a roughly a dozen messages."
- §3.1.1¶3: "The baselines are able to see a lossy summarization of the past five conversations to mimic an extended recursive summarization procedure, while MemGPT instead has access to the full conversation history but must access it via paginated search queries to recall memory"
- §3.1.2¶2: "Additionally, we can see the storing information in working context is key to generating engaging openers."
- §3.2.1¶3: "sampled a subset of 50 questions for evaluation"
- §3.2.1¶4: "The fixed-context baselines performance is capped roughly at the performance of the retriever, as they use the information that is presented in their context window"
- §3.2.1¶5: "we observe that MemGPT will often stop paging through retriever results before exhausting the retriever database."
- §3.2.1¶6: "MemGPT has significantly degraded performance using GPT-3.5, due to its limited function calling capabilities, and performs best using GPT-4."
- §3.2.2¶1: "In our setup, we fix the total number of UUIDs pairs to 140, corresponding to roughly 8k tokens (the context length of our GPT-4 baseline)."
- §3.2.2¶2: "GPT-4 and GPT-4 Turbo are better than GPT-3.5, but also suffer from a similar dropoff, and hit 0 percent accuracy by 3 nesting levels. MemGPT with GPT-4 on the other hand is unaffected with the number of nesting levels"
- §4¶1: "Our main contribution is a hierarchical tiered memory that uses a long-context LLM as the implementation of main memory."
- §4¶3: "Park et al. (2023) propose adding memory to LLMs and using the LLM as a planner"
- §5¶1: "This work opens numerous avenues for future exploration, including applying MemGPT to other domains with massive or unbounded contexts, integrating different memory tier technologies like databases or caches, and further improving control flow and memory management policies."
- §6.1.2¶1: "The generated answer might be much longer, but you should be generous with your grading - as long as it touches on the same topic as the gold answer, it should be counted as CORRECT."
- §1¶1: "the most widely used open-source LLMs can only support a few dozen back-and-forth messages or reason about a short document before exceeding their maximum input length"
- §1¶4: "This allows for an agent to choose to iteratively modify what is in its context for a single task, thereby more effectively utilizing its limited context."
- §2.2¶1: "The queue manager writes both the incoming message and the generated LLM output to recall storage (the MemGPT message database)."
- §2.4¶1: "In MemGPT, events trigger LLM inference"
- §3¶2: "‘GPT-4 Turbo’ refers to the specific gpt-4-1106-preview model endpoint (context window of 128,000"
- §3.1.1¶1: "In DMR, the conversational agent is asked a question by the user that explicitly refers back to a prior conversation and has a very narrow expected answer range."
