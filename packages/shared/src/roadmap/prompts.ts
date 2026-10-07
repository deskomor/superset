import { quoteSelection } from "../terminal-session-handoff";
import {
	RoadmapError,
	type RoadmapView,
	type RoadmapViewStep,
} from "./roadmap";

const ASK_TOOL =
	"your ask-the-user tool (AskUserQuestion or the equivalent your agent has)";

const CLI_USAGE =
	"Change the Roadmap with the superset CLI: each superset roadmap <plan|check|backlog|milestone> command takes --input '<json>' and prints JSON; superset roadmap <command> --help lists the fields. Run superset roadmap read first to get the revision to pass as expectedRevision. The conversation of the current terminal is linked automatically.";

export const TASK_STEPS = [
	'1. A task whose note starts with "Plan ready:" is already planned: go to step 6 for it.',
	"2. Inspect the code, documents and AGENTS.md files the tasks touch. Do not change project files yet. Never ask the user for a fact the project can answer.",
	"3. Score the ambiguity of each task. Rate each dimension from 0.0 (unknown) to 1.0 (clear): intent (why the change is wanted), outcome (the end state), scope (where the change stops), constraints (limits that must hold), success (how completion is judged), context (how well you understand the affected code after step 2).",
	"   ambiguity = 1 - (intent × 0.25 + outcome × 0.20 + scope × 0.20 + constraints × 0.15 + success × 0.10 + context × 0.10). The threshold is 0.30.",
	`   - Above the threshold: ask one question with ${ASK_TOOL} about the weakest dimension other than context (improve context by inspecting more). Re-score after each answer. Stop after 5 questions or when the user says to go on, and list the remaining assumptions in the plan.`,
	`   - If ${ASK_TOOL} is not available and a task is above the threshold: do not rewrite that task. Give its scores and the questions you would ask in your final answer, and stop.`,
	"   - At or below the threshold: do not ask. State your assumptions in the plan.",
	"4. Rewrite each task with its plan. Do not create a Roadmap plan: plans are for larger work. If a task is too large for one task, say so in your answer and suggest a plan instead.",
	'   - Replace the task note with the plan, and sharpen the task text when it is vague. The note starts with the line "Plan ready: <one-line scope>", then has these Markdown sections: Objective (what and why), Context (files, constraints, assumptions, and the final ambiguity score), Approach (read the applicable AGENTS.md files before edits), Verification (the commands and checks to run), Done when.',
	"   - Plan task: use superset roadmap plan with action step_edit for the text and note. Add one child task per verifiable change with step_add (parentId: the task), in execution order; the child note gives the check that proves it. When the task is already at the third level, put the changes as a numbered list in the note instead.",
	"   - Backlog entry: use superset roadmap backlog with action edit for the text and note. Add the changes as a numbered list in the note, each with the check that proves it.",
	"   - Plan or milestone in the same selection: complete its summary and tasks. Do not create a second plan.",
	`5. Ask the user with ${ASK_TOOL}: "Implement now" or "Keep in the Roadmap for later". If that tool is not available, ask in your final answer and stop.`,
	"6. Implement now: do the changes in order. Check a child task with superset roadmap check only after its check passed; check the task itself (superset roadmap check, or superset roadmap backlog with action set with done for a backlog entry) when all its changes are done. Journal the outcome on the plan of a plan task. End with the result, the checks and what remains to do.",
	'   Keep for later: stop. Name the tasks and say that "Work on task" in the Roadmap starts the implementation.',
];

export const PLAN_STEPS = [
	'1. Read each plan with superset roadmap read (target plan). For a milestone, take its active plans in Roadmap order. A plan whose summary starts with "Plan ready:" is already planned: go to step 6 for it.',
	`2. For the other plans, ask the user once with ${ASK_TOOL} which planf3 route to use: "Full consensus" (the default planf3 route, with Architect and Critic reviews) or "Direct" (planf3 --direct). Without that tool, use Direct and say so.`,
	"3. Read the planf3 SKILL.md and run the chosen route for each plan, one plan at a time. The request is the plan title, summary and open tasks. planf3 inspects the project without changing files and ends with one approved <proposed_plan> block. That block is an intermediate result, not your final answer: these steps take precedence over the planf3 output rule, so continue with step 4 in the same turn.",
	`   If the planf3 skill is not installed: inspect the code, documents and AGENTS.md files the plan touches, score its ambiguity (intent × 0.25 + outcome × 0.20 + scope × 0.20 + constraints × 0.15 + success × 0.10 + context × 0.10, subtracted from 1; threshold 0.30), and ask up to 5 questions with ${ASK_TOOL} while it is above the threshold.`,
	"4. Write each approved plan into its Roadmap plan with superset roadmap plan:",
	'   - patch: the summary starts with the line "Plan ready: <one-line scope>", then short Objective, Approach, Verification and Done when sections. Keep it under 2,000 characters: superset roadmap read shows only that much.',
	"   - Tasks: one task per verifiable change, in execution order, with its detail and the check that proves it in the note (step_add, step_edit). Keep checked tasks; remove a task only with step_remove.",
	"   - journal: one line that names the planf3 route used.",
	`5. Ask the user with ${ASK_TOOL}: "Implement now" or "Keep in the Roadmap for later". If that tool is not available, ask in your final answer and stop.`,
	'   Keep for later: stop. Name the plans and say that "Work on plan" in the Roadmap starts the implementation.',
	"6. Implement now: read the applicable AGENTS.md files before you edit. Do the open tasks in order. Check a task with superset roadmap check only after its check passed, and journal the outcome on its plan. End with the result, the checks and what remains to do.",
];

export type RoadmapCreateKind = "task" | "plan";

/** Side-chat workflow: create one Roadmap entry from the quoted passage, then plan it. */
export function createWorkflow(kind: RoadmapCreateKind): string {
	const task = kind === "task";
	return [
		CLI_USAGE,
		"Read the current state with superset roadmap read before you change the Roadmap. Update tasks and their journal only for work actually done.",
		task
			? "First add one backlog entry with superset roadmap backlog with action add: one sharpened line that states the task as text, the quoted passage and its source in the note, and this conversation in sessions. Then plan that entry as the selected task with these steps:"
			: "First create one plan with superset roadmap plan with action create: a short title, the quoted passage and its source in the summary, and this conversation in sessions. Then plan it as the selected plan with the planf3 skill and these steps:",
		(task ? TASK_STEPS : PLAN_STEPS).join("\n"),
	].join("\n\n");
}

/** The first message of a side session that turns a selection into a Roadmap task or plan. */
export function buildCreateFromSelectionPrompt(input: {
	kind: RoadmapCreateKind;
	selection: string;
	/** Names where the passage came from, e.g. "a Claude conversation in this workspace". */
	source?: string;
}): string {
	const lead =
		input.kind === "task"
			? "Create a Roadmap task from this passage from another conversation, then plan it:"
			: "Create a Roadmap plan from this passage from another conversation, then plan it:";
	const prompt = [
		lead,
		input.source ? `Source: ${input.source}.` : "",
		quoteSelection(input.selection),
	]
		.filter(Boolean)
		.join("\n\n");
	return `${prompt}\n\n${createWorkflow(input.kind)}`;
}

export type RoadmapWorkTarget =
	| { kind: "plan"; planId: string; stepId?: string }
	| { kind: "milestone"; milestoneId: string }
	| { kind: "backlog"; number: number };

function findStep(
	steps: RoadmapViewStep[],
	id: string,
): RoadmapViewStep | null {
	for (const step of steps) {
		if (step.id === id) return step;
		const found = findStep(step.children, id);
		if (found) return found;
	}
	return null;
}

const MAX_WORK_PROMPT_CHARS = 180000;

/** The "Work on" message for a selection of Roadmap targets. */
export function buildRoadmapWorkPrompt(
	view: RoadmapView,
	targets: RoadmapWorkTarget[],
	instructions = "",
): string {
	if (!targets.length || targets.length > 20)
		throw new RoadmapError("invalid", "Select between one and twenty tasks.");
	const seen = new Set<string>();
	const sections: Record<string, unknown>[] = [];
	for (const target of targets) {
		let reference: RoadmapWorkTarget;
		if (target.kind === "plan") {
			const plan = view.plans.find((entry) => entry.id === target.planId);
			if (!plan)
				throw new RoadmapError(
					"not_found",
					"A selected plan was deleted. Refresh the Roadmap.",
				);
			const step = target.stepId ? findStep(plan.steps, target.stepId) : null;
			if (target.stepId && !step)
				throw new RoadmapError(
					"not_found",
					"A selected task was deleted. Refresh the Roadmap.",
				);
			reference = {
				kind: "plan",
				planId: plan.id,
				...(step ? { stepId: step.id } : {}),
			};
			sections.push({
				reference,
				title: plan.title,
				...(step
					? { task: step.text, note: step.note }
					: { summary: plan.summary }),
			});
		} else if (target.kind === "milestone") {
			const milestone = view.overview.milestones.find(
				(entry) => entry.id === target.milestoneId,
			);
			if (!milestone)
				throw new RoadmapError(
					"not_found",
					"A selected milestone was deleted. Refresh the Roadmap.",
				);
			reference = { kind: "milestone", milestoneId: milestone.id };
			sections.push({
				reference,
				title: milestone.title,
				summary: milestone.summary,
				plans: view.plans
					.filter(
						(plan) =>
							plan.milestone === milestone.id && plan.status !== "abandoned",
					)
					.map((plan) => ({ id: plan.id, title: plan.title })),
			});
		} else {
			const entry = [...view.backlog.items, ...view.backlog.notes].find(
				(item) => item.number === target.number,
			);
			if (!entry)
				throw new RoadmapError(
					"not_found",
					"A selected item was deleted. Refresh the Roadmap.",
				);
			reference = { kind: "backlog", number: entry.number };
			sections.push({ reference, task: entry.text, note: entry.note });
		}
		const key = JSON.stringify(reference);
		if (seen.has(key))
			throw new RoadmapError("invalid", "A task was selected more than once.");
		seen.add(key);
	}
	// Tasks are planned in place; plans and milestones go through planf3.
	const taskMode = targets.some(
		(target) =>
			target.kind === "backlog" || (target.kind === "plan" && target.stepId),
	);
	const parts = [
		taskMode
			? "Plan the following tasks from this project Roadmap, then ask the user whether to implement them now."
			: "Plan the following plans from this project Roadmap with the planf3 skill, then ask the user whether to implement them now.",
		`Revision read: ${view.revision}. Read the current state with superset roadmap read before you change the Roadmap.`,
		CLI_USAGE,
		"Update tasks and their journal only for work actually done.",
		(taskMode ? TASK_STEPS : PLAN_STEPS).join("\n"),
	];
	if (instructions)
		parts.push(
			`Additional user instructions (they take precedence over the steps above):\n${instructions}`,
		);
	parts.push(JSON.stringify(sections, null, 2));
	const message = parts.join("\n\n");
	if (message.length > MAX_WORK_PROMPT_CHARS)
		throw new RoadmapError(
			"invalid",
			"The selection is too large. Choose fewer tasks.",
		);
	return message;
}
