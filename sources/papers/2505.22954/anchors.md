# Darwin Godel Machine: Open-Ended Evolution of Self-Improving Agents

## §1 Introduction
## §2 Related Work
## §3 Darwin Gödel Machine
## §4 Experiments
## §4.1 Experiment Setup
## §4.2 Benchmarks
## §4.3 Baselines
## §4.4 Results
## §5 Safety Discussion
## §6 Conclusion and Limitations
- Fig. 1 — Darwin Gödel Machine.
- Fig. 2 — Self-improvement and open-ended exploration enable the DGM to continue making progress and improve its performance.
- Fig. 3 — The DGM automatically self-improves to become a better coding agent.
- Fig. 4 — Transfer between Models, Benchmarks, and Tasks.
- Fig. 5 — DGM without self-improving agents.
- Fig. 6 — DGM without open-ended exploration.
- Fig. 7 — Transfer between Models on Polyglot
- Fig. 8 — The DGM solving hallucination of tool use in FMs.
- Tab. 1 — Comparison of DGM, its ablations, and baselines on SWE-bench and Polyglot benchmarks.
- Tab. 2 — Percentage of generated agents with basic code-editing functionality on SWE-bench.
- Tab. 3 — Foundation models used in each experiment setting.

- §1¶1: "most of today’s AI systems remain bound by fixed, human-designed architectures that learn within predefined boundaries, without the capacity to autonomously rewrite their own source code to self-improve"
- §1¶2: "Instead of requiring formal proofs, we empirically validate self-modifications against a benchmark, allowing the system to improve and explore based on observed results."
- §1¶2: "However, in practice and without restrictive assumptions about the system, it is impossible to formally prove whether a modification to an AI system will be beneficial."
- §1¶3: "accumulating diverse stepping stones (i.e., interesting yet suboptimal solutions or features that may enable future breakthroughs)"
- §1¶3: "However, we do not show that in this paper, as training FMs is computationally intensive"
- §1¶3: "A key assumption is that an increase in performance on coding benchmarks indicates better coding capabilities, and hence better ability to self-modify and self-improve."
- §2¶2: "removing the need for a fixed, handcrafted meta-agent and enabling self-referential improvements"
- §2¶3: "However, the downstream tasks or the meta-utility do not always align with the capabilities required for self-improvement."
- §2¶3: "which also has a single agent recursively solving coding problems and modifying its own codebase"
- §2¶3: "the DGM has an open-ended exploration loop, encouraging self-modifications beyond immediate performance gains and thus avoiding stagnation in suboptimal states"
- §3¶1: "instead requiring empirical evidence from experiments to demonstrate that a proposed new version enhances performance"
- §3¶2: "A coding agent is defined as a single system, implemented with a code repository and powered by frozen pretrained foundation models (FMs), capable of reading, writing, and executing code."
- §3¶2: "we define self-improvement as a coding task that involves modifying the design of an agent’s own components"
- §3¶3: "Parent selection is roughly proportional to each agent’s performance score and inversely proportional to the number of its children with codebase-editing functionality"
- §3¶3: "Only agents that compile successfully and retain the ability to edit a given codebase are added to the DGM archive"
- §3¶3: "making our approach substantially different from hill-climbing agentic design approaches"
- §3¶3: "Currently, the open-ended exploration process (i.e., archive maintenance, parent selection) is fixed and not modifiable by the DGM, which we leave as an avenue for future work."
- §3¶3: "Each selected parent analyzes its own benchmark evaluation logs, proposes the next feature to implement, and receives this proposal as a problem statement to execute"
- §4.1¶1: "The base agent is intentionally lightweight to provide a simple starting point from which self-improvement can be clearly demonstrated."
- §4.1¶1: "The base agent has access to two tools: a Bash tool for executing bash commands, and an edit tool for viewing and editing directories and entire files"
- §4.2¶2: "Throughout this paper, the term SWE-bench refers by default to to the SWE-bench Verified subset."
- §4.2¶3: "whereas we report pass@1, where the agent never sees ground-truth test results"
- §4.2¶4: "Since it is expensive to evaluate on the full benchmarks"
- §4.2¶4: "We first evaluate each coding agent on a set of 10 tasks to verify basic codebase-editing functionality."
- §4.2¶4: "it is then evaluated on 200 tasks (140 plus the previous 60)"
- §4.3¶1: "eliminates the use of an archive and always self-modifies the latest stored version of itself"
- §4.3¶1: "wherein the meta agent responsible for modifying the coding agents remains fixed as the base agent throughout the experiment"
- §4.4¶1: "it discovers an agent that far surpasses Aider"
- §4.4¶1: "the performance of the best DGM-discovered agent is comparable to that of the checked, open-source, human-designed SoTA on SWE-bench"
- §4.4¶1: "On the full Polyglot benchmark, the DGM improves the coding agent from 14.2% to 30.7%."
- §4.4¶1: "the coding agent’s performance increases from 20.0% to 50.0% on SWE-bench, and from 14.0% to 38.0% on Polyglot"
- §4.4¶2: "Workflow improvements include making multiple attempts to solve a task and using another FM to evaluate and select the best solution."
- §4.4¶2: "the DGM enhanced the edit tool to allow more granular file viewing (by lines) and more precise file editing (by string replacement), instead of always viewing or replacing the entire file"
- §4.4¶3: "at iterations 4 and 56 of the experiment on SWE-bench, although the agent’s score temporarily fell below that of its parent"
- §4.4¶4: "a poorly performing self-modification makes subsequent improvements harder to achieve"
- §4.4¶4: "DGM w/o self-improve improves the agents in early iterations, but its gains taper off quickly"
- §4.4¶5: "With o3-mini, the base agent achieved 23.0% and the DGM-discovered agent 33.0%."
- §4.4¶5: "With Claude 3.7 Sonnet, the base agent achieved 19.0% and the DGM-discovered agent 59.5%."
- §4.4¶6: "the best agent evolved on Polyglot achieves 24.5% on SWE-bench"
- §4.4¶6: "The best agent evolved on SWE-bench achieves 28.9% on Polyglot, compared to the initial agent’s baseline of 14.2%."
- §5¶1: "Iterative self-modification could also lead to increasingly complex and uninterpretable internal logic"
- §5¶1: "Modifications optimized solely for benchmark performance might inadvertently introduce vulnerabilities or behaviors misaligned with human intentions"
- §5¶1: "if evaluation benchmarks do not fully capture all desired agent properties (e.g., safety and robustness), the self-improvement loop could amplify misalignment over successive generations"
- §5¶2: "At this stage, we have found no evidence of harmful or malicious behavior in the generated agents"
- §5¶2: "All agent execution and self-modification processes are conducted within isolated sandboxed environments"
- §5¶3: "if such properties were included in its evaluation criteria"
- §6¶2: "However, it still falls short of closed-source SoTA SWE-bench solutions."
- §6¶2: "takes about 2 weeks and incurs significant API costs"
- §6¶3: "one could envision an alternative approach that co-evolves the target task distribution"
- §6¶3: "an exciting future direction is to extend self-modification beyond just prompts or FM workflows, to include more computationally intensive methods, such as rewriting its own training script to update the FM itself"
- §6¶3: "A key assumption in this work is that coding benchmarks are a good reflection of the agent’s ability to self-improve"
- §4.3¶2: "For Polyglot, we take the representative agent (Aider)"
