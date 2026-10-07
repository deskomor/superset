export const ROADMAP_MAX_BYTES = 4 * 1024 * 1024;
const MAX_STEPS = 2000;
const NOTES_MAX = 100000;
const PLAN_STATUSES = ["active", "done", "paused", "abandoned"] as const;
const MILESTONE_STATUSES = ["planned", "active", "done"] as const;

export type RoadmapPlanStatus = (typeof PLAN_STATUSES)[number];
export type RoadmapMilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export type RoadmapErrorCode =
	| "invalid"
	| "not_found"
	| "roadmap_conflict"
	| "uninitialized"
	| "too_large"
	| "busy"
	| "corrupt";

export class RoadmapError extends Error {
	readonly code: RoadmapErrorCode;
	readonly currentRevision?: number;

	constructor(
		code: RoadmapErrorCode,
		message: string,
		extra: { currentRevision?: number } = {},
	) {
		super(message);
		this.name = "RoadmapError";
		this.code = code;
		this.currentRevision = extra.currentRevision;
	}
}

export interface RoadmapActor {
	by: "user" | "agent";
	sessionId?: string;
	name?: string;
}

export type RoadmapEdit = RoadmapActor & { at: number };

export interface RoadmapStep {
	id: string;
	text: string;
	note: string;
	done: boolean;
	children: RoadmapStep[];
}

export type RoadmapJournalEntry = RoadmapActor & {
	id: string;
	at: number;
	text: string;
};

export interface RoadmapPlan {
	id: string;
	slug: string;
	title: string;
	summary: string;
	status: RoadmapPlanStatus;
	milestone: string | null;
	sessions: string[];
	steps: RoadmapStep[];
	journal: RoadmapJournalEntry[];
	createdAt: number;
	updatedAt: number;
}

export interface RoadmapMilestone {
	id: string;
	title: string;
	summary: string;
	status: RoadmapMilestoneStatus;
}

export type RoadmapBacklogNote = RoadmapActor & {
	number: number;
	text: string;
	note: string;
	addedAt: number;
	sessions: string[];
};

export type RoadmapBacklogItem = RoadmapBacklogNote & { done: boolean };

export interface Roadmap {
	schemaVersion: 1;
	revision: number;
	lastEdit: RoadmapEdit | null;
	overview: {
		vision: string;
		notes: string;
		milestones: RoadmapMilestone[];
	};
	plans: RoadmapPlan[];
	backlog: {
		items: RoadmapBacklogItem[];
		notes: RoadmapBacklogNote[];
		nextNumber: number;
	};
}

export interface RoadmapStepInput {
	id?: string;
	text?: string;
	note?: string;
	done?: boolean;
	children?: RoadmapStepInput[];
}

export interface RoadmapBacklogEntryInput {
	text: string;
	note?: string;
	sessions?: string[];
}

type MovePosition = "before" | "after";

export type RoadmapAction =
	| { action: "init" }
	| { action: "vision"; text?: string }
	| { action: "notes"; text?: string }
	| {
			action: "milestone.create";
			title: string;
			summary?: string;
			status?: RoadmapMilestoneStatus;
	  }
	| {
			action: "milestone.patch";
			milestoneId: string;
			title?: string;
			summary?: string;
			status?: RoadmapMilestoneStatus;
	  }
	| { action: "milestone.delete"; milestoneId: string }
	| {
			action: "milestone.move";
			milestoneId: string;
			targetId: string;
			position: MovePosition;
	  }
	| {
			action: "plan.create";
			title: string;
			summary?: string;
			status?: RoadmapPlanStatus;
			milestone?: string | null;
			sessions?: string[];
			steps?: RoadmapStepInput[];
	  }
	| {
			action: "plan.patch";
			planId: string;
			title?: string;
			summary?: string;
			status?: RoadmapPlanStatus;
			milestone?: string | null;
	  }
	| { action: "plan.attach"; planId: string; sessionId: string }
	| { action: "plan.delete"; planId: string }
	| { action: "plan.steps"; planId: string; steps: RoadmapStepInput[] }
	| {
			action: "step.add";
			planId: string;
			text: string;
			note?: string;
			parentId?: string | null;
			afterId?: string | null;
	  }
	| {
			action: "step.edit";
			planId: string;
			stepId: string;
			text?: string;
			note?: string;
	  }
	| {
			action: "step.check";
			planId: string;
			stepId?: string;
			stepIds?: string[];
			done: boolean;
			note?: string;
			comment?: string;
	  }
	| { action: "step.remove"; planId: string; stepId: string }
	| {
			action: "step.move";
			planId: string;
			stepId: string;
			targetId?: string;
			position?: MovePosition | "inside";
			direction?: "up" | "down" | "indent" | "outdent";
	  }
	| { action: "journal.add"; planId: string; text: string }
	| {
			action: "backlog.add";
			items?: RoadmapBacklogEntryInput[];
			notes?: RoadmapBacklogEntryInput[];
	  }
	| { action: "backlog.edit"; number: number; text?: string; note?: string }
	| { action: "backlog.set"; numbers: number[]; done: boolean }
	| { action: "backlog.remove"; numbers: number[] }
	| {
			action: "backlog.move";
			number: number;
			targetNumber: number;
			position: MovePosition;
	  }
	| { action: "backlog.convert"; number: number; kind: "item" | "note" };

export interface RoadmapProgress {
	done: number;
	total: number;
	percent: number;
}

export type RoadmapViewStep = RoadmapStep & {
	partial: boolean;
	children: RoadmapViewStep[];
};

export type RoadmapViewPlan = Omit<RoadmapPlan, "steps"> & {
	steps: RoadmapViewStep[];
	progress: RoadmapProgress;
};

export interface RoadmapView {
	initialized: boolean;
	revision: number;
	lastEdit: RoadmapEdit | null;
	overview: {
		vision: string;
		notes: string;
		milestones: (RoadmapMilestone & { progress: RoadmapProgress })[];
		progress: RoadmapProgress;
	};
	plans: RoadmapViewPlan[];
	backlog: Roadmap["backlog"];
	progress: RoadmapProgress;
}

type Loose = Record<string, unknown>;

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const isObject = (value: unknown): value is Loose =>
	!!value && typeof value === "object" && !Array.isArray(value);
const own = (value: object, key: string) => Object.hasOwn(value, key);
const invalid = (message = "The Roadmap change is invalid.") =>
	new RoadmapError("invalid", message);
const missing = (message: string) => new RoadmapError("not_found", message);

function text(value: unknown, label: string, max = 8000, optional = false) {
	if (optional && (value === undefined || value === null)) return "";
	if (
		typeof value !== "string" ||
		value.length > max ||
		value.includes("\u0000") ||
		(!optional && !value.trim())
	)
		throw invalid(`Invalid ${label} (maximum ${max} characters).`);
	return value.trim();
}

// Free Markdown keeps its leading indentation (indented code); only the end is trimmed.
function markdownText(value: unknown, label: string, max: number) {
	if (value === undefined || value === null) return "";
	if (
		typeof value !== "string" ||
		value.length > max ||
		value.includes("\u0000")
	)
		throw invalid(`Invalid ${label} (maximum ${max} characters).`);
	return value.trim() ? value.trimEnd() : "";
}

function identifier(value: unknown, label = "Id"): string {
	if (
		typeof value !== "string" ||
		!/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(value)
	)
		throw invalid(`Invalid ${label}.`);
	return value;
}

function integer(value: unknown, label: string, minimum = 0): number {
	if (!Number.isSafeInteger(value) || (value as number) < minimum)
		throw invalid(`Invalid ${label}.`);
	return value as number;
}

function boolean(value: unknown): boolean {
	if (typeof value !== "boolean")
		throw invalid("The checkbox must be checked or unchecked explicitly.");
	return value;
}

function list(value: unknown, label: string, max = 2000): unknown[] {
	if (!Array.isArray(value) || value.length > max)
		throw invalid(`Invalid ${label} (maximum ${max} items).`);
	return value;
}

function status<T extends string>(value: unknown, values: readonly T[]): T {
	if (!values.includes(value as T)) throw invalid("Invalid Roadmap status.");
	return value as T;
}

function sessionList(value: unknown): string[] {
	return [
		...new Set(
			list(value ?? [], "Conversations", 500).map((entry) =>
				identifier(entry, "Session"),
			),
		),
	];
}

function who(actor: unknown = {}): RoadmapActor {
	if (!isObject(actor)) throw invalid("Invalid author.");
	const by = actor.by ?? "user";
	if (by !== "user" && by !== "agent") throw invalid("Invalid author.");
	const result: RoadmapActor = { by };
	if (actor.sessionId !== undefined)
		result.sessionId = identifier(actor.sessionId, "Session");
	if (actor.name !== undefined)
		result.name = text(actor.name, "Name", 200, true);
	return result;
}

function progress(steps: RoadmapStep[]): RoadmapProgress {
	let done = 0;
	let total = 0;
	for (const step of steps) {
		if (step.children.length) {
			const value = progress(step.children);
			total += value.total;
			done += value.done;
		} else {
			total++;
			if (step.done) done++;
		}
	}
	return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

function aggregate(plans: { progress: RoadmapProgress }[]): RoadmapProgress {
	let done = 0;
	let total = 0;
	for (const plan of plans) {
		done += plan.progress.done;
		total += plan.progress.total;
	}
	return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

function derivedSteps(steps: RoadmapStep[]): RoadmapViewStep[] {
	return steps.map((step) => {
		const children = derivedSteps(step.children);
		const value = progress(children);
		return {
			...step,
			children,
			done: children.length ? value.done === value.total : step.done,
			partial: children.length
				? value.done > 0 && value.done < value.total
				: false,
		};
	});
}

export function emptyRoadmap(): Roadmap {
	return {
		schemaVersion: 1,
		revision: 0,
		lastEdit: null,
		overview: { vision: "", notes: "", milestones: [] },
		plans: [],
		backlog: { items: [], notes: [], nextNumber: 1 },
	};
}

export function roadmapView(doc: Roadmap): RoadmapView {
	const plans = doc.plans.map((plan) => ({
		...plan,
		steps: derivedSteps(plan.steps),
		progress: progress(plan.steps),
	}));
	const activePlans = plans.filter((plan) => plan.status !== "abandoned");
	const value = aggregate(activePlans);
	return {
		initialized: doc.revision > 0,
		revision: doc.revision,
		lastEdit: doc.lastEdit,
		overview: {
			...doc.overview,
			milestones: doc.overview.milestones.map((milestone) => ({
				...milestone,
				progress: aggregate(
					activePlans.filter((plan) => plan.milestone === milestone.id),
				),
			})),
			progress: value,
		},
		plans,
		backlog: doc.backlog,
		progress: value,
	};
}

interface StepLocation {
	step: RoadmapStep;
	siblings: RoadmapStep[];
	index: number;
	parent: RoadmapStep | null;
	depth: number;
}

function collectSteps(
	steps: RoadmapStep[],
	map = new Map<string, StepLocation>(),
	parent: RoadmapStep | null = null,
	depth = 1,
) {
	for (let index = 0; index < steps.length; index++) {
		const step = steps[index] as RoadmapStep;
		map.set(step.id, { step, siblings: steps, index, parent, depth });
		collectSteps(step.children, map, step, depth + 1);
	}
	return map;
}

function normalizeSteps(
	input: unknown,
	{
		old = [],
		creating = false,
		exact = false,
	}: { old?: RoadmapStep[]; creating?: boolean; exact?: boolean } = {},
): RoadmapStep[] {
	const existing = collectSteps(old);
	const seen = new Set<string>();
	let count = 0;
	const visit = (nodes: unknown, depth: number): RoadmapStep[] =>
		list(nodes, "Tasks", MAX_STEPS).map((node) => {
			if (++count > MAX_STEPS || depth > 3 || !isObject(node))
				throw invalid(
					"A checklist accepts at most three levels and 2,000 tasks.",
				);
			if (
				exact &&
				(!Array.isArray(node.children) || typeof node.done !== "boolean")
			)
				throw invalid("A saved task is incomplete.");
			const stepId =
				node.id === undefined && !exact
					? newId("step")
					: identifier(node.id, "Task");
			if (seen.has(stepId)) throw invalid("Each task must have a unique id.");
			seen.add(stepId);
			const previous = existing.get(stepId)?.step;
			if (!creating && !exact && node.id !== undefined && !previous)
				throw invalid(
					"A new task must omit its id; existing ids stay unchanged.",
				);
			const children = visit(
				node.children === undefined && previous
					? previous.children
					: (node.children ?? []),
				depth + 1,
			);
			const childProgress = progress(children);
			return {
				id: stepId,
				text: text(
					node.text === undefined && previous ? previous.text : node.text,
					"Task text",
				),
				note: text(
					node.note === undefined && previous ? previous.note : node.note,
					"Note",
					16000,
					true,
				),
				done: children.length
					? childProgress.done === childProgress.total
					: node.done === undefined && previous
						? previous.done
						: node.done === undefined && !exact
							? false
							: boolean(node.done),
				children,
			};
		});
	const result = visit(input, 1);
	if (
		!creating &&
		!exact &&
		[...existing.keys()].some((stepId) => !seen.has(stepId))
	)
		throw invalid(
			"An existing task is missing. Remove it explicitly before you replace the plan.",
		);
	return result;
}

export function validateRoadmap(raw: unknown): Roadmap {
	if (
		!isObject(raw) ||
		raw.schemaVersion !== 1 ||
		!isObject(raw.overview) ||
		!isObject(raw.backlog)
	)
		throw invalid();
	const overview = raw.overview;
	const backlog = raw.backlog;
	const revision = integer(raw.revision, "Revision", 1);
	const lastEdit = isObject(raw.lastEdit) ? raw.lastEdit : {};
	const edit: RoadmapEdit = {
		...who(lastEdit),
		at: integer(lastEdit.at, "Date", 1),
	};
	const milestoneIds = new Set<string>();
	const milestones = list(overview.milestones, "Milestones", 200).map(
		(entry): RoadmapMilestone => {
			if (!isObject(entry)) throw invalid();
			const milestoneId = identifier(entry.id, "Milestone");
			if (milestoneIds.has(milestoneId)) throw invalid();
			milestoneIds.add(milestoneId);
			return {
				id: milestoneId,
				title: text(entry.title, "Title", 300),
				summary: text(entry.summary, "Summary", 16000, true),
				status: status(entry.status, MILESTONE_STATUSES),
			};
		},
	);
	const planIds = new Set<string>();
	const slugs = new Set<string>();
	const allStepIds = new Set<string>();
	const plans = list(raw.plans, "Plans", 200).map((entry): RoadmapPlan => {
		if (!isObject(entry)) throw invalid();
		const planId = identifier(entry.id, "Plan");
		const slug = identifier(entry.slug, "Plan name");
		if (planIds.has(planId) || slugs.has(slug) || !planId.startsWith("plan-"))
			throw invalid();
		planIds.add(planId);
		slugs.add(slug);
		const milestone =
			entry.milestone === null
				? null
				: identifier(entry.milestone, "Milestone");
		if (milestone !== null && !milestoneIds.has(milestone)) throw invalid();
		const steps = normalizeSteps(entry.steps, { exact: true });
		for (const stepId of collectSteps(steps).keys()) {
			if (allStepIds.has(stepId))
				throw invalid("Each task in the project must have its own id.");
			allStepIds.add(stepId);
		}
		const sessions = list(entry.sessions, "Conversations", 500).map((value) =>
			identifier(value, "Session"),
		);
		if (new Set(sessions).size !== sessions.length) throw invalid();
		const journalIds = new Set<string>();
		const journal = list(entry.journal, "Journal", 2000).map(
			(item): RoadmapJournalEntry => {
				if (!isObject(item)) throw invalid();
				const journalId = identifier(item.id, "Journal entry");
				if (journalIds.has(journalId)) throw invalid();
				journalIds.add(journalId);
				return {
					id: journalId,
					at: integer(item.at, "Date", 1),
					text: text(item.text, "Journal entry", 16000),
					...who(item),
				};
			},
		);
		return {
			id: planId,
			slug,
			title: text(entry.title, "Title", 300),
			summary: text(entry.summary, "Summary", 16000, true),
			status: status(entry.status, PLAN_STATUSES),
			milestone,
			sessions,
			steps,
			journal,
			createdAt: integer(entry.createdAt, "Date", 1),
			updatedAt: integer(entry.updatedAt, "Date", 1),
		};
	});
	const backlogNumbers = new Set<number>();
	const backlogEntry = (entry: unknown): RoadmapBacklogNote => {
		if (!isObject(entry)) throw invalid();
		const number = integer(entry.number, "Number", 1);
		if (backlogNumbers.has(number)) throw invalid();
		backlogNumbers.add(number);
		return {
			number,
			text: text(entry.text, "Text"),
			note: text(entry.note, "Note", 16000, true),
			addedAt: integer(entry.addedAt, "Date", 1),
			...who(entry),
			sessions: sessionList(entry.sessions),
		};
	};
	const items = list(backlog.items, "Backlog", 2000).map((entry) => ({
		...backlogEntry(entry),
		done: boolean((entry as Loose).done),
	}));
	const notes = list(backlog.notes, "Backlog", 2000).map(backlogEntry);
	const nextNumber = integer(backlog.nextNumber, "Next number", 1);
	if ([...backlogNumbers].some((number) => number >= nextNumber))
		throw invalid();
	return {
		schemaVersion: 1,
		revision,
		lastEdit: edit,
		overview: {
			vision: text(overview.vision, "Vision", 20000, true),
			notes: markdownText(overview.notes, "Notes", NOTES_MAX),
			milestones,
		},
		plans,
		backlog: { items, notes, nextNumber },
	};
}

function findPlan(doc: Roadmap, planId: unknown): RoadmapPlan {
	identifier(planId, "Plan");
	const plan = doc.plans.find(
		(entry) => entry.id === planId || entry.slug === planId,
	);
	if (!plan) throw missing("This plan was not found in the project.");
	return plan;
}

function findStep(plan: RoadmapPlan, stepId: unknown): StepLocation {
	identifier(stepId, "Task");
	const found = collectSteps(plan.steps).get(stepId as string);
	if (!found) throw missing("This task was not found in the plan.");
	return found;
}

function findMilestone(doc: Roadmap, milestoneId: unknown): RoadmapMilestone {
	identifier(milestoneId, "Milestone");
	const found = doc.overview.milestones.find(
		(entry) => entry.id === milestoneId,
	);
	if (!found) throw missing("This milestone was not found in the project.");
	return found;
}

function findBacklog(doc: Roadmap, number: unknown) {
	integer(number, "Number", 1);
	const groups: [RoadmapBacklogNote[], boolean][] = [
		[doc.backlog.items, false],
		[doc.backlog.notes, true],
	];
	for (const [entries, isNote] of groups) {
		const index = entries.findIndex((entry) => entry.number === number);
		if (index !== -1)
			return {
				entry: entries[index] as RoadmapBacklogNote,
				entries,
				index,
				isNote,
			};
	}
	throw missing("This item was not found in the backlog.");
}

function addJournal(
	plan: RoadmapPlan,
	value: unknown,
	actor: RoadmapActor,
	now: number,
) {
	if (plan.journal.length >= 2000)
		throw invalid("The journal already has 2,000 entries.");
	plan.journal.push({
		id: newId("journal"),
		at: now,
		text: text(value, "Journal entry", 16000),
		...actor,
	});
}

function moveInList<T>(entries: T[], value: T, target: T, position: unknown) {
	if (position !== "before" && position !== "after")
		throw invalid("Invalid move position.");
	if (value === target) return;
	entries.splice(entries.indexOf(value), 1);
	entries.splice(
		entries.indexOf(target) + (position === "after" ? 1 : 0),
		0,
		value,
	);
}

function subtreeDepth(step: RoadmapStep): number {
	return 1 + Math.max(0, ...step.children.map(subtreeDepth));
}

function moveStep(plan: RoadmapPlan, input: Loose) {
	const source = findStep(plan, input.stepId);
	let destination: RoadmapStep[];
	let index: number;
	if (input.direction !== undefined) {
		if (input.targetId !== undefined || input.position !== undefined)
			throw invalid("Choose a move direction or target.");
		switch (input.direction) {
			case "up":
			case "down": {
				const next = source.index + (input.direction === "up" ? -1 : 1);
				if (next < 0 || next >= source.siblings.length) return;
				source.siblings.splice(source.index, 1);
				source.siblings.splice(next, 0, source.step);
				return;
			}
			case "indent": {
				const previous = source.siblings[source.index - 1];
				if (!previous) throw invalid("No previous task can hold this group.");
				if (source.depth + subtreeDepth(source.step) > 3)
					throw invalid("The checklist is limited to three levels.");
				destination = previous.children;
				index = destination.length;
				break;
			}
			case "outdent": {
				if (!source.parent)
					throw invalid("This task is already at the top level.");
				const parent = findStep(plan, source.parent.id);
				destination = parent.siblings;
				index = parent.index + 1;
				break;
			}
			default:
				throw invalid("Invalid move direction.");
		}
	} else {
		const position = input.position;
		if (position !== "before" && position !== "after" && position !== "inside")
			throw invalid("Invalid move position.");
		const target = findStep(plan, input.targetId);
		if (source.step === target.step) return;
		if (collectSteps([source.step]).has(target.step.id))
			throw invalid("A task cannot be moved into its descendants.");
		const depth = target.depth + (position === "inside" ? 1 : 0);
		if (depth + subtreeDepth(source.step) - 1 > 3)
			throw invalid("The checklist is limited to three levels.");
		destination =
			position === "inside" ? target.step.children : target.siblings;
		index =
			position === "inside"
				? destination.length
				: target.index + (position === "after" ? 1 : 0);
	}
	if (destination === source.siblings && source.index < index) index--;
	source.siblings.splice(source.index, 1);
	destination.splice(index, 0, source.step);
}

function slugBase(title: string) {
	return (
		title
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 70) || "plan"
	);
}

function backlogEntries(value: unknown, label: string) {
	return list(value ?? [], label).map((entry) => {
		if (!isObject(entry)) throw invalid();
		return entry;
	});
}

function apply(
	doc: Roadmap,
	action: RoadmapAction,
	actor: RoadmapActor,
	now: number,
) {
	if (!isObject(action) || typeof action.action !== "string") throw invalid();
	const input = action as unknown as Loose;
	const plan =
		(action.action.startsWith("plan.") && action.action !== "plan.create") ||
		action.action.startsWith("step.") ||
		action.action === "journal.add"
			? findPlan(doc, input.planId)
			: null;
	if (plan) plan.updatedAt = now;
	const needPlan = () => plan as RoadmapPlan;
	switch (action.action) {
		case "init":
			break;
		case "vision":
			doc.overview.vision = text(input.text, "Vision", 20000, true);
			break;
		case "notes":
			doc.overview.notes = markdownText(input.text, "Notes", NOTES_MAX);
			break;
		case "milestone.create":
			doc.overview.milestones.push({
				id: newId("milestone"),
				title: text(input.title, "Title", 300),
				summary: text(input.summary, "Summary", 16000, true),
				status: status(input.status ?? "planned", MILESTONE_STATUSES),
			});
			break;
		case "milestone.patch": {
			const milestone = findMilestone(doc, input.milestoneId);
			if (own(input, "title"))
				milestone.title = text(input.title, "Title", 300);
			if (own(input, "summary"))
				milestone.summary = text(input.summary, "Summary", 16000, true);
			if (own(input, "status"))
				milestone.status = status(input.status, MILESTONE_STATUSES);
			break;
		}
		case "milestone.delete": {
			const milestone = findMilestone(doc, input.milestoneId);
			doc.overview.milestones = doc.overview.milestones.filter(
				(entry) => entry !== milestone,
			);
			for (const entry of doc.plans)
				if (entry.milestone === milestone.id) {
					entry.milestone = null;
					entry.updatedAt = now;
				}
			break;
		}
		case "milestone.move":
			moveInList(
				doc.overview.milestones,
				findMilestone(doc, input.milestoneId),
				findMilestone(doc, input.targetId),
				input.position,
			);
			break;
		case "plan.create": {
			const planId = newId("plan");
			const title = text(input.title, "Title", 300);
			doc.plans.push({
				id: planId,
				slug: `${slugBase(title)}-${planId.slice(-8)}`,
				title,
				summary: text(input.summary, "Summary", 16000, true),
				status: status(input.status ?? "active", PLAN_STATUSES),
				milestone:
					input.milestone == null
						? null
						: findMilestone(doc, input.milestone).id,
				sessions: sessionList(input.sessions),
				steps: normalizeSteps(input.steps ?? [], { creating: true }),
				journal: [],
				createdAt: now,
				updatedAt: now,
			});
			break;
		}
		case "plan.patch": {
			const target = needPlan();
			if (own(input, "title")) target.title = text(input.title, "Title", 300);
			if (own(input, "summary"))
				target.summary = text(input.summary, "Summary", 16000, true);
			if (own(input, "status")) {
				const value = status(input.status, PLAN_STATUSES);
				if (target.status !== value)
					addJournal(target, `Status: ${target.status} → ${value}`, actor, now);
				target.status = value;
			}
			if (own(input, "milestone"))
				target.milestone =
					input.milestone === null
						? null
						: findMilestone(doc, input.milestone).id;
			break;
		}
		case "plan.attach": {
			const target = needPlan();
			const sessionId = identifier(input.sessionId, "Session");
			if (!target.sessions.includes(sessionId)) target.sessions.push(sessionId);
			break;
		}
		case "plan.delete":
			doc.plans = doc.plans.filter((entry) => entry !== plan);
			break;
		case "plan.steps": {
			const target = needPlan();
			target.steps = normalizeSteps(input.steps, { old: target.steps });
			break;
		}
		case "step.add": {
			const target = needPlan();
			const parent =
				input.parentId === undefined || input.parentId === null
					? null
					: findStep(target, input.parentId);
			if (parent && parent.depth >= 3)
				throw invalid("The checklist is limited to three levels.");
			const entries = parent ? parent.step.children : target.steps;
			const next: RoadmapStep = {
				id: newId("step"),
				text: text(input.text, "Task text"),
				note: text(input.note, "Note", 16000, true),
				done: false,
				children: [],
			};
			let index = entries.length;
			if (input.afterId !== undefined && input.afterId !== null) {
				const after = findStep(target, input.afterId);
				if (after.siblings !== entries)
					throw invalid("The previous task must belong to the same group.");
				index = after.index + 1;
			}
			entries.splice(index, 0, next);
			break;
		}
		case "step.edit": {
			const { step } = findStep(needPlan(), input.stepId);
			if (own(input, "text")) step.text = text(input.text, "Task text");
			if (own(input, "note")) step.note = text(input.note, "Note", 16000, true);
			break;
		}
		case "step.check": {
			const target = needPlan();
			if (own(input, "stepId") && own(input, "stepIds"))
				throw invalid("Choose a task or a list of tasks.");
			const stepIds = own(input, "stepIds")
				? list(input.stepIds, "Tasks to check", MAX_STEPS)
				: [input.stepId];
			if (!stepIds.length || (stepIds.length !== 1 && own(input, "note")))
				throw invalid("A task note must target one task.");
			const selected = [...new Set(stepIds)].map(
				(stepId) => findStep(target, stepId).step,
			);
			const done = boolean(input.done);
			for (const selectedStep of selected)
				for (const { step } of collectSteps([selectedStep]).values())
					step.done = done;
			if (own(input, "note"))
				(selected[0] as RoadmapStep).note = text(
					input.note,
					"Note",
					16000,
					true,
				);
			if (input.comment !== undefined && input.comment !== "")
				addJournal(target, input.comment, actor, now);
			break;
		}
		case "step.remove": {
			const found = findStep(needPlan(), input.stepId);
			found.siblings.splice(found.index, 1);
			break;
		}
		case "step.move":
			moveStep(needPlan(), input);
			break;
		case "journal.add":
			addJournal(needPlan(), input.text, actor, now);
			break;
		case "backlog.add": {
			const items = backlogEntries(input.items, "Backlog items");
			const notes = backlogEntries(input.notes, "Backlog notes");
			if (!items.length && !notes.length)
				throw invalid("Add at least one item to the backlog.");
			const entry = (value: Loose): RoadmapBacklogNote => ({
				number: doc.backlog.nextNumber++,
				text: text(value.text, "Text"),
				note: text(value.note, "Note", 16000, true),
				addedAt: now,
				...actor,
				sessions: sessionList(value.sessions),
			});
			for (const value of items)
				doc.backlog.items.push({ ...entry(value), done: false });
			for (const value of notes) doc.backlog.notes.push(entry(value));
			break;
		}
		case "backlog.edit": {
			const { entry } = findBacklog(doc, input.number);
			if (own(input, "text")) entry.text = text(input.text, "Text");
			if (own(input, "note"))
				entry.note = text(input.note, "Note", 16000, true);
			break;
		}
		case "backlog.set": {
			const numbers = list(input.numbers, "Backlog items");
			if (!numbers.length) throw invalid("Select at least one item.");
			const done = boolean(input.done);
			const entries = numbers.map((number) => findBacklog(doc, number));
			if (entries.some((entry) => entry.isNote))
				throw invalid("A note has no checkbox.");
			for (const { entry } of entries)
				(entry as RoadmapBacklogItem).done = done;
			break;
		}
		case "backlog.remove": {
			const numbers = new Set(list(input.numbers, "Backlog items"));
			if (!numbers.size) throw invalid("Select at least one item.");
			for (const number of numbers) findBacklog(doc, number);
			doc.backlog.items = doc.backlog.items.filter(
				(entry) => !numbers.has(entry.number),
			);
			doc.backlog.notes = doc.backlog.notes.filter(
				(entry) => !numbers.has(entry.number),
			);
			break;
		}
		case "backlog.move": {
			const source = findBacklog(doc, input.number);
			const target = findBacklog(doc, input.targetNumber);
			if (source.entries !== target.entries)
				throw invalid("Convert this item before you move it to another group.");
			moveInList(source.entries, source.entry, target.entry, input.position);
			break;
		}
		case "backlog.convert": {
			if (input.kind !== "item" && input.kind !== "note")
				throw invalid("Invalid backlog type.");
			const source = findBacklog(doc, input.number);
			if (source.isNote === (input.kind === "note")) break;
			source.entries.splice(source.index, 1);
			if (input.kind === "note") {
				const { done: _done, ...note } = source.entry as RoadmapBacklogItem;
				doc.backlog.notes.push(note);
			} else doc.backlog.items.push({ ...source.entry, done: false });
			break;
		}
		default:
			throw invalid("Unknown Roadmap action.");
	}
}

export function applyRoadmapActions(
	doc: Roadmap,
	actions: RoadmapAction[],
	actor: RoadmapActor,
	options: { expectedRevision?: number; now?: number } = {},
): Roadmap {
	if (!Array.isArray(actions) || !actions.length || actions.length > 200)
		throw invalid("Provide between one and 200 Roadmap actions.");
	if (doc.revision > 0 && actions.every((entry) => entry?.action === "init"))
		return doc;
	if (
		options.expectedRevision !== undefined &&
		options.expectedRevision !== doc.revision
	)
		throw new RoadmapError(
			"roadmap_conflict",
			`The Roadmap changed since you read it (current revision ${doc.revision}). Read it again before you apply your change.`,
			{ currentRevision: doc.revision },
		);
	if (doc.revision === 0 && actions[0]?.action !== "init")
		throw new RoadmapError(
			"uninitialized",
			"Initialize the Roadmap before you change it.",
		);
	const attribution = who(actor);
	const now = options.now ?? Date.now();
	const next = structuredClone(doc);
	for (const action of actions) apply(next, action, attribution, now);
	next.revision++;
	next.lastEdit = { ...attribution, at: now };
	return validateRoadmap(next);
}

export function applyRoadmapAction(
	doc: Roadmap,
	action: RoadmapAction,
	actor: RoadmapActor,
	now = Date.now(),
): Roadmap {
	return applyRoadmapActions(doc, [action], actor, { now });
}

export function roadmapMarkdown(
	view: RoadmapView,
	projectName?: string,
): string {
	const title = (input: string) => input.replace(/[\r\n]+/g, " ");
	const lines = [
		projectName ? `# Roadmap — ${title(projectName)}` : "# Roadmap",
		"",
		`Revision: ${view.revision}`,
		`Declared progress: ${view.progress.done}/${view.progress.total} tasks checked (${view.progress.percent}%).`,
		"",
		"> Markdown export. The project JSON document stays the source of changes.",
		"",
	];
	if (!view.initialized)
		return `${lines.join("\n")}\nRoadmap not initialized.\n`;
	if (view.overview.vision)
		lines.push("## Vision", "", view.overview.vision, "");
	if (view.overview.milestones.length) {
		lines.push("## Milestones", "");
		for (const milestone of view.overview.milestones) {
			lines.push(
				`### ${title(milestone.title)}`,
				"",
				`Status: ${milestone.status} · ${milestone.progress.done}/${milestone.progress.total} tasks checked`,
			);
			if (milestone.summary) lines.push("", milestone.summary);
			lines.push("");
		}
	}
	const emitSteps = (steps: RoadmapViewStep[], depth = 0) => {
		for (const step of steps) {
			const pad = "  ".repeat(depth);
			const [first, ...rest] = step.text.split("\n");
			lines.push(`${pad}- [${step.done ? "x" : " "}] ${first}`);
			for (const extra of rest) lines.push(`${pad}  ${extra}`);
			if (step.note)
				for (const note of step.note.split("\n"))
					lines.push(`${pad}  > ${note}`);
			emitSteps(step.children, depth + 1);
		}
	};
	if (view.plans.length) lines.push("## Plans", "");
	for (const plan of view.plans) {
		lines.push(
			`### ${title(plan.title)}`,
			"",
			`Id: ${plan.id}`,
			`Status: ${plan.status}${plan.status === "abandoned" ? " (excluded from project progress)" : ""} · ${plan.progress.done}/${plan.progress.total} tasks checked`,
		);
		const milestone = view.overview.milestones.find(
			(entry) => entry.id === plan.milestone,
		);
		if (milestone) lines.push(`Milestone: ${title(milestone.title)}`);
		if (plan.sessions.length)
			lines.push(`Conversations: ${plan.sessions.join(", ")}`);
		if (plan.summary) lines.push("", plan.summary);
		lines.push("");
		emitSteps(plan.steps);
		if (plan.journal.length) {
			lines.push("", "#### Journal", "");
			for (const entry of plan.journal)
				lines.push(
					`- ${new Date(entry.at).toISOString()} · ${entry.name || entry.by}${entry.sessionId ? ` · ${entry.sessionId}` : ""}\n  ${entry.text.replace(/\n/g, "\n  ")}`,
				);
		}
		lines.push("");
	}
	if (view.overview.notes) lines.push("## Notes", "", view.overview.notes, "");
	lines.push("## Backlog", "", "Outside the progress of committed plans.", "");
	const quoted = (note: string) =>
		note ? `\n  > ${note.replace(/\n/g, "\n  > ")}` : "";
	for (const entry of view.backlog.items)
		lines.push(
			`- [${entry.done ? "x" : " "}] #${entry.number} ${entry.text.replace(/\n/g, "\n  ")}${quoted(entry.note)}`,
		);
	if (view.backlog.notes.length) lines.push("", "### Notes", "");
	for (const entry of view.backlog.notes)
		lines.push(
			`- #${entry.number} ${entry.text.replace(/\n/g, "\n  ")}${quoted(entry.note)}`,
		);
	return `${lines.join("\n")}\n`;
}
