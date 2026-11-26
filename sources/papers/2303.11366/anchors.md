# Reflexion: Language Agents with Verbal Reinforcement Learning

## §1 Introduction
## §2 Related work
## §3 Reflexion: reinforcement via verbal reflection
## §4 Experiments
## §4.1 Sequential decision making: ALFWorld
## §4.2 Reasoning: HotpotQA
## §4.3 Programming
## §5 Limitations
## §6 Broader impact
## §7 Conclusion
## §8 Reproducibility
- Fig. 1 — Reflexion works on decision-making 4.1 , programming 4.3 , and reasoning 4.2 tasks.
- Fig. 2 — (a) Diagram of Reflexion. (b) Reflexion reinforcement algorithm
- Fig. 3 — (a) AlfWorld performance across 134 tasks showing cumulative proportions of solved tasks using self-evaluation
- Fig. 4 — Chain-of-Thought (CoT) and ReAct.
- Fig. 5 — [Top] An AlfWorld trajectory in which the agent failed due to inefficient planning.
- Fig. 6 — Reflexion vs React performance on WebShop across 100 customer shopping requests.
- Fig. 7 — Two HotPotQA trials within the same environment and task.
- Tab. 1 — Pass@1 accuracy for various model-strategy-language combinations. The base strategy is a single code generation sample.
- Tab. 2 — Overall accuracy and test generation performance for HumanEval and MBPP.
- Tab. 3 — Pass@1 accuracy for various compromised approaches on the Reflexion approach using GPT-4 as the base model on HumanEval
- Tab. 4 — Pass@1 accuracy on HumanEval Python using starchat-beta [ 13 ] .
- Tab. 5 — Pass@1 accuracy on 100 HotPotQA using various models.
- §1¶1: "limited to using in-context examples as a way of teaching the agents"
- §1¶2: "This self-reflective feedback acts as a ‘semantic’ gradient signal"
- §1¶2: "which is then added as additional context for the LLM agent in the next episode"
- §1¶3: "the credit assignment problem"
- §1¶3: "the evaluation signal is amplified to natural language experience summaries which can be stored in long-term memory"
- §1¶4: "relying on the power of the LLM’s self-evaluation capabilities (or heuristics) and not having a formal guarantee for success"
- §1¶4: "it is lightweight and doesn’t require finetuning the LLM"
- §1¶5: "Reflexion agents improve on decision-making AlfWorld [ 24 ] tasks over strong baseline approaches by an absolute 22% in 12 iterative learning steps"
- §1¶6: "parameterizes a policy as an agent’s memory encoding paired with a choice of LLM parameters"
- §2¶1: "Self-Refine is effective but is limited to single-generation reasoning tasks"
- §2¶1: "build a persisting memory of self-reflective experiences"
- §3¶1: "utilizing three distinct models"
- §3¶2: "We explore various Actor models, including Chain of Thought [ 26 ] and ReAct [ 30 ] ."
- §3¶3: "For reasoning tasks, we explore reward functions based on exact match (EM) grading"
- §3¶4: "In subsequent trials, the agent can leverage its past experiences to adapt its decision-making approach"
- §3¶5: "the trajectory history serves as the short-term memory while outputs from the Self-Reflection model are stored in long-term memory"
- §3¶6: "The Actor, Evaluator, and Self-Reflection models work together through trials in a loop until the Evaluator deems"
- §3¶6: "we bound mem by a maximum number of stored experiences"
- §4¶1: "Reflexion improves performance over strong baselines by 22% in AlfWorld, 20% in HotPotQA, and 11% on HumanEval."
- §4.1¶1: "if the agent executes the same action and receives the same response for more than 3 cycles, or if the number of actions taken in the current environment exceeds 30"
- §4.1¶1: "we truncate the agent’s memory to the last 3 self-reflections (experiences)"
- §4.1¶1: "the agent uses self-reflection to find its mistake, update its memory, reset the environment, and start a new trial"
- §4.1¶3: "In the ReAct-only approach, we see that performance increase halts between trials 6 and 7."
- §4.1¶3: "ReAct + Reflexion significantly outperforms ReAct by completing 130 out of 134 tasks"
- §4.1¶4: "a ReAct-only agent converging at a hallucination rate of 22% with no signs of long-term recovery"
- §4.2¶2: "we use exact match answer grading using the environment to give a binary success signal to the agent"
- §4.2¶3: "no failed tasks from the first trial from any of the baseline approaches were able to be solved in subsequent trials"
- §4.2¶3: "Reflexion helps the agent to correct its mistakes without access to the ground truth answer to improve its accuracy by 14%"
- §4.2¶3: "we allowed the agent to gather experience and retry on failed tasks until it produced 3 consecutive failed attempts on the particular task"
- §4.2¶4: "we add an element of episodic memory (EPM) by including the most recent trajectory"
- §4.2¶4: "self-reflection improves learning by an 8% absolute boost over the episodic memory learning advantage"
- §4.3¶2: "We set n to a maximum of 6 unit tests."
- §4.3¶2: "with a max memory limit of 1 experience"
- §4.3¶4: "the false positive test execution rate for MBPP Python is 16.3% while the rate for HumanEval Python is a mere 1.4%"
- §4.3¶5: "the agent is unable to determine if the current implementation is correct without unit tests"
- §4.3¶6: "the compromised agent does not improve performance over the baseline run"
- §5¶1: "vector embedding databases or traditional SQL databases"
- §5¶1: "we limit long-term memory to a sliding window with maximum capacity"
- §5¶1: "it may still succumb to non-optimal local minima solutions"
- §6¶2: "self-reflections could be monitored to ensure proper intent before using the tool"
- §4.1¶2: "We use the same few-shot trajectory examples as Yao et al., [30] with GPT-3 for the LLM."
- §4.2¶1: "we implement a Reflexion + ReAct [ 30 ] agent that can retrieve relevant context using a Wikipedia API"
