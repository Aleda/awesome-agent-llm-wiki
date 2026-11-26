# Voyager: An Open-Ended Embodied Agent with Large Language Models

## §1 Introduction
## §2 Method
## §2.1 Automatic Curriculum
## §2.2 Skill Library
## §2.3 Iterative Prompting Mechanism
## §3 Experiments
## §3.1 Experimental Setup
## §3.2 Baselines
## §3.3 Evaluation Results
## §3.4 Ablation Studies
## §3.5 Multimodal Feedback from Humans
## §4 Limitations and Future Work
## §5 Related work
## §6 Conclusion
## §7 Broader Impacts
## §8 Acknowledgements
- Fig. 1 — Voyager discovers new Minecraft items and skills continually by self-driven exploration, significantly outperforming
- Fig. 2 — Voyager consists of three key components:
- Fig. 3 — Tasks proposed by the automatic curriculum. We only display the partial prompt for brevity. See Appendix, Sec. A.
- Fig. 4 — Skill library. Top: Adding a new skill.
- Fig. 5 — Left: Environment feedback. GPT-4 realizes it needs 2 more planks before crafting sticks. Right: Execution error.
- Fig. 6 — Self-verification examples. We only display the partial prompt for brevity. See Appendix, Sec. A.
- Fig. 7 — Map coverage: bird’s eye views of Minecraft maps. Voyager is able to traverse 2.
- Fig. 8 — Zero-shot generalization to unseen tasks. We visualize the intermediate progress of each method on two tasks.
- Fig. 9 — Left: Ablation studies for the automatic curriculum, skill library, and GPT-4. GPT-3.5 means replacing GPT-4 with GPT-3.
- Fig. 10 — Voyager builds 3D structures with human feedback.
- Tab. 1 — Tech tree mastery. Fractions indicate the number of successful trials out of three total runs.
- Tab. 2 — Zero-shot generalization to unseen tasks.
- §1¶1: "these agents are not lifelong learners that can progressively acquire, update, accumulate, and transfer knowledge over extended time spans"
- §1¶3: "We opt to use code as the action space instead of low-level motor commands"
- §1¶3: "Our approach bypasses the need for model parameter access and explicit gradient-based training or finetuning."
- §1¶3: "the first LLM-powered embodied lifelong learning agent"
- §1¶4: "This approach can be perceived as an in-context form of novelty search"
- §1¶4: "alleviates catastrophic forgetting in other continual learning methods"
- §1¶4: "Complex skills can be synthesized by composing simpler programs"
- §1¶4: "Each program is indexed by the embedding of its description, which can be retrieved in similar situations in the future."
- §1¶6: "Voyager outperforms prior SOTA by obtaining"
- §2.1¶2: "My ultimate goal is to discover as many diverse things as possible"
- §2.1¶2: "Previously completed and failed tasks"
- §2.2¶1: "we represent each skill with executable code that scaffolds temporally extended actions"
- §2.2¶2: "Your function will be reused for building more complex functions. Therefore, you should make it generic and reusable."
- §2.2¶3: "we query the skill library with the embedding of self-generated task plans and environment feedback"
- §2.3¶1: "we instantiate another GPT-4 agent for self-verification"
- §2.3¶1: "our self-verification is more comprehensive than self-reflection [ 30 ] by both checking success and reflecting on mistakes"
- §2.3¶2: "If the agent gets stuck after 4 rounds of code generation, then we query the curriculum for another task."
- §3.1¶1: "Our simulation environment is built on top of MineDojo [ 23 ] and leverages Mineflayer [ 52 ] JavaScript APIs for motor controls."
- §3.2¶1: "These methods are originally designed only for NLP tasks without embodiment"
- §3.2¶3: "We provide it with execution errors and our self-verification module."
- §3.2¶5: "because we rely on the high-level Mineflayer [ 52 ] API to control the agent"
- §3.3¶2: "ReAct and Reflexion struggle to make significant progress, given the abstract nature of the open-ended exploration goal that is challenging to execute without an appropriate curriculum"
- §3.3¶2: "discovering 63 unique items within 160 prompting iterations"
- §3.3¶3: "Voyager is the only one to unlock the diamond level of the tech tree"
- §3.3¶4: "while the baseline agents often find themselves confined to local areas"
- §3.3¶5: "baselines cannot solve any task within 50 prompting iterations"
- §3.3¶5: "our skill library constructed from lifelong learning not only enhances Voyager ’s performance but also gives a boost to AutoGPT"
- §3.4¶1: "Voyager w/o skill library exhibits a tendency to plateau in the later stages."
- §3.4¶1: "Self-verification is the most important among all the feedback types"
- §3.4¶1: "because certain tasks may be too challenging if attempted out of order"
- §3.5¶1: "Voyager does not currently support visual perception"
- §4¶1: "The GPT-4 API incurs significant costs."
- §4¶2: "not recognizing spider string as a success signal of beating a spider"
- §4¶3: "The automatic curriculum occasionally proposes unachievable tasks."
- §5¶2: "Code as Policies [ 16 ] and ProgPrompt [ 22 ] directly leverage LLMs to generate executable robot policies"
- §5¶2: "All these works lack a skill library for developing more complex behaviors"
- §6¶1: "Voyager serves as a starting point to develop powerful generalist agents without tuning the model parameters."
- §2.1¶1: "The curriculum unfolds in a bottom-up fashion, allowing for considerable adaptability and responsiveness to the exploration progress and the agent’s current state"
- §3.2¶2: "We provide it with our environment feedback and the agent states as observations."
