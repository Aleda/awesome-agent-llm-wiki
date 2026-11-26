# SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering

## §1 Introduction
## §2 The Agent-Computer Interface
## §3 SWE-agent: Designing an ACI for Software Engineering
## §4 Experimental Setup
## §5 Results
## §5.1 Analysis of ACI Design
## §5.2 Analysis of Agent Behavior
## §6 Related Work
## §6.1 Software Engineering Benchmarks
## §6.2 Language Models as Agents
## §7 Discussion
- Fig. 1 — SWE-agent is an LM interacting with a computer through an agent-computer interface (ACI), which includes the commands
- Fig. 2 — Specialized applications like IDEs (e.g.
- Fig. 3 — The file viewer and edit command are integrated.
- Fig. 4 — SWE-agent w/ GPT-4 Turbo Pass@k performance across 6 runs on SWE-bench Lite.
- Fig. 5 — Three different Search interfaces for task instance pvlib__pvlib-python-1224 .
- Fig. 6 — Three different Edit interfaces for task instance sympy__sympy-24102 .
- Fig. 7 — The frequency with which actions are invoked at each turn by SWE-agent w/ GPT-4 for task instances that it solved on
- Fig. 8 — Failure mode distribution for SWE-agent w/ GPT-4 Turbo trajectories of unresolved instances.
- Fig. 9 — An overview over the structure of a trajectory:
- Fig. 10 — The File Viewer and Search components of the SWE-agent interface.
- Fig. 11 — A linting error message.
- Fig. 12 — An example of the configuration file that defines the SWE-agent ACI. A configuration is represented as a single .
- Fig. 13 — The skeleton code for defining a command that can be accessed in the SWE-agent ACI.
- Fig. 14 — Distribution of the number of turns for interactive trajectories corresponding to solved task instances on SWE-bench.
- Fig. 15 — The distribution of agent trajectories by total steps (left) and cost (right) for SWE-agent with GPT-4 Turbo on
- Fig. 16 — We assign each pattern to one of five categories (as presented in Table 8 ) and present a histogram of the turns at
- Fig. 17 — This density plot shows a normalized distribution of actions across different turns of a trajectory.
- Fig. 18 — A normalized view of Figure 8 .
- Fig. 19 — Distribution of the number of failed edit actions per trajectory across all (left) and resolved (right) task instances
- Fig. 20 — Probability of successful edit after n failed edits. The likelihood of recovery decreases as n increases.
- Fig. 21 — Heatmap displaying the relative frequency of different actions being invoked after the most popular actions in
- Fig. 22 — Heatmap displaying the relative frequency of different actions being invoked after the most popular pairs of actions in
- Fig. 23 — Heatmap displaying the relative frequency of different actions being invoked after the most popular triplets of actions
- Fig. 24 — Heatmap displaying the relative frequency of different actions being invoked after the most popular quadruplets of
- Fig. 25 — Similar to Figure 14 , we show the distribution of the number of turns for trajectories corersponding to solved task
- Fig. 26 — The flow of prompt templates throughout a single SWE-agent task instance episode.
- Fig. 27 — The system prompt for SWE-agent describes the environment.
- Fig. 28 — A simplified demonstration template showing how demonstrations are provided to the model as a single message.
- Fig. 29 — The instance template.
- Fig. 30 — The environment’s “next step" template.
- Fig. 31 — A collapsed environment response. The content of old observations are replaced with this template.
- Fig. 32 — The environment’s error message.
- Fig. 33 — Trajectory for instance psf__requests-2317 .
- Fig. 34 — Trajectory for instance pylint-dev__pylint-5859 .
- Fig. 35 — Trajectory for instance sympy__sympy-21614 .
- Fig. 36 — Trajectory for instance django__django-14411 .
- Tab. 2 — Pass@1 results on HumanEvalFix [ 32 ] . Except for SWE-agent, we use scores as reported in Yu et al. [65] .
- Tab. 1 — Main results for SWE-agent performance on the full and Lite splits of the SWE-bench test set.
- Tab. 3 — SWE-bench Lite performance under ablations to the SWE-agent interface, which is denoted by .
- Tab. 4 — In additional to the standard Linux Bash commands, we provide SWE-agent with specialized tools, including an
- Tab. 5 — Hyper parameter sweep results on a subset of the SWE-bench dev split. % Resolved shows the mean score across 5 samples.
- Tab. 6 — % Resolved performance across repositories represented in the SWE-bench Lite dataset.
- Tab. 7 — % Resolved performance for task instances from different years represented in the SWE-bench Lite dataset.
- Tab. 8 — We present a table of the most frequently occurring action patterns at each turn (“frequently" means \geq 4 times) in
- Tab. 9 — Descriptions of failure mode categories.
- Tab. 10 — Performance for 6 separate runs of SWE-agent with GPT-4 on SWE-bench Lite.
- Tab. 11 — We show the (median) / (mean) value for several statistics characterizing patch generations.
- Tab. 12 — Information about each of the datasets that we evaluate SWE-agent on.
- Tab. 13 — This table showcases the counts for the four ways (“Submit", “Exit Cost (Submit)", “Exit Cost (No Submit)", “Early
- §1¶1: "Inspired by human-computer interaction (HCI) studies on the efficacy of user interfaces for humans"
- §1¶1: "LM agents are typically designed to use existing applications, such as the Linux shell or Python interpreter"
- §1¶2: "an abstraction layer between the LM agent and computer"
- §1¶2: "it fails to provide simple commands to edit a small file segment, and does not provide any feedback if the user makes an invalid edit"
- §1¶4: "Although our ACI was developed for GPT-4 Turbo, we show that it is portable to a different LM"
- §1¶4: "SWE-agent solves 10.7 percentage points more instances than the baseline agent, which uses only the default Linux shell"
- §1¶5: "careful ACI design can substantially improve LM agent performance without modifying the underlying LM’s weights"
- §2¶1: "We argue that LM agents represent a new category of end user, with their own needs and abilities"
- §2¶2: "all content has a fixed cost in memory and computation for LMs and distracting context can harm performance"
- §2¶3: "The ACI specifies both the commands available to the LM and how the environment state is communicated back to the LM"
- §2¶4: "we assume a fixed LM and focus on designing the ACI to improve its performance"
- §2¶5: "Environment feedback should be informative but concise"
- §3¶1: "SWE-agent generates a thought and a command, then incorporates the feedback from the command’s execution in the environment"
- §3¶2: "if a search exceeds this number, we do not report the results and instead suggest that the agent write a more specific query"
- §3¶3: "The file viewer presents a window of at most 100 lines of the file at a time"
- §3¶4: "allowing agents to replace a specific range of lines in the open file"
- §3¶5: "Invalid edits are discarded, and the agent is asked to try editing the file again"
- §3¶6: "Once received, all past error messages except the first are omitted"
- §3¶7: "which allows for more interaction cycles and avoids showing outdated file information"
- §3¶7: "observations preceding the last 5 are each collapsed into a single line"
- §4¶2: "GPT-4 Turbo and Claude 3 Opus have 128k and 200k token context windows"
- §4¶2: "Many LMs’ context window is too small, such as Llama 3’s context window of 8k"
- §4¶4: "this baseline system asks the LM to resolve the issue by interacting with a shell process on Linux"
- §4¶5: "averaged over all successfully resolved instances"
- §4¶6: "through qualitative analysis of system behavior on a small set of hand-picked examples from the development split of SWE-bench"
- §5.1¶1: "specifically with respect to the SWE-agent w/ GPT-4 configuration"
- §5.1¶3: "agents tend to look through every match exhaustively"
- §5.1¶4: "We also find that agents are sensitive to the number of lines the file viewer displays"
- §5.1¶5: "we add an intervention to the edit logic that lets a modification apply only if it does not produce major errors"
- §5.2¶4: "This probability drops off to 57.2% after a single failed edit"
- §5.2¶5: "we suspect that increasing the maximum budget or token limit are unlikely to substantially increase performance"
- §5.2¶5: "we find that 93.0% of resolved instances are submitted before exhausting their cost budget, compared to 69.0% of instances overall"
- §5.2¶6: "On a hand-labeled validation set, the LM’s judgment agrees with the authors’ on 87% of instances"
- §5.2¶6: "Cascading failed edits make up another 23.4% of failures"
- §5¶1: "An LM-friendly ACI’s value is confirmed by SWE-agent’s 64% relative increase compared to Shell-only"
- §5¶2: "SWE-agent yields strong performance on HumanEvalFix with 88.3% pass@1 rate"
- §5¶2: "average performance variance is relatively low, but per-instance resolution can change considerably"
- §7¶1: "analogous to the synergy between human-computer interaction (HCI) and psychology"
