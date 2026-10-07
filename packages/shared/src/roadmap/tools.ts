import { z } from "zod";
import {
	type RoadmapAction,
	RoadmapError,
	type RoadmapStepInput,
	type RoadmapView,
} from "./roadmap";

const id = z.string().min(1).max(200);
const shortText = z.string().min(1).max(1000);
const note = z.string().max(12000);
const revision = z.number().int().min(0);
const backlogNumber = z.number().int().min(1);
const movePosition = z.enum(["before", "after"]);
const planStatus = z.enum(["active", "done", "paused", "abandoned"]);
const milestoneStatus = z.enum(["planned", "active", "done"]);

const stepInputSchema: z.ZodType<RoadmapStepInput> = z.lazy(() =>
	z.object({
		id: z.string().optional(),
		text: z.string().optional(),
		note: z.string().optional(),
		done: z.boolean().optional(),
		children: z.array(stepInputSchema).optional(),
	}),
);

const backlogEntryInput = z.object({
	text: z.string(),
	note: z.string().optional(),
	sessions: z.array(z.string()).optional(),
});

export const roadmapActionSchema: z.ZodType<RoadmapAction> =
	z.discriminatedUnion("action", [
		z.object({ action: z.literal("init") }),
		z.object({ action: z.literal("vision"), text: z.string().optional() }),
		z.object({ action: z.literal("notes"), text: z.string().optional() }),
		z.object({
			action: z.literal("milestone.create"),
			title: z.string(),
			summary: z.string().optional(),
			status: milestoneStatus.optional(),
		}),
		z.object({
			action: z.literal("milestone.patch"),
			milestoneId: z.string(),
			title: z.string().optional(),
			summary: z.string().optional(),
			status: milestoneStatus.optional(),
		}),
		z.object({
			action: z.literal("milestone.delete"),
			milestoneId: z.string(),
		}),
		z.object({
			action: z.literal("milestone.move"),
			milestoneId: z.string(),
			targetId: z.string(),
			position: movePosition,
		}),
		z.object({
			action: z.literal("plan.create"),
			title: z.string(),
			summary: z.string().optional(),
			status: planStatus.optional(),
			milestone: z.string().nullable().optional(),
			sessions: z.array(z.string()).optional(),
			steps: z.array(stepInputSchema).optional(),
		}),
		z.object({
			action: z.literal("plan.patch"),
			planId: z.string(),
			title: z.string().optional(),
			summary: z.string().optional(),
			status: planStatus.optional(),
			milestone: z.string().nullable().optional(),
		}),
		z.object({
			action: z.literal("plan.attach"),
			planId: z.string(),
			sessionId: z.string(),
		}),
		z.object({ action: z.literal("plan.delete"), planId: z.string() }),
		z.object({
			action: z.literal("plan.steps"),
			planId: z.string(),
			steps: z.array(stepInputSchema),
		}),
		z.object({
			action: z.literal("step.add"),
			planId: z.string(),
			text: z.string(),
			note: z.string().optional(),
			parentId: z.string().nullable().optional(),
			afterId: z.string().nullable().optional(),
		}),
		z.object({
			action: z.literal("step.edit"),
			planId: z.string(),
			stepId: z.string(),
			text: z.string().optional(),
			note: z.string().optional(),
		}),
		z.object({
			action: z.literal("step.check"),
			planId: z.string(),
			stepId: z.string().optional(),
			stepIds: z.array(z.string()).optional(),
			done: z.boolean(),
			note: z.string().optional(),
			comment: z.string().optional(),
		}),
		z.object({
			action: z.literal("step.remove"),
			planId: z.string(),
			stepId: z.string(),
		}),
		z.object({
			action: z.literal("step.move"),
			planId: z.string(),
			stepId: z.string(),
			targetId: z.string().optional(),
			position: z.enum(["before", "after", "inside"]).optional(),
			direction: z.enum(["up", "down", "indent", "outdent"]).optional(),
		}),
		z.object({
			action: z.literal("journal.add"),
			planId: z.string(),
			text: z.string(),
		}),
		z.object({
			action: z.literal("backlog.add"),
			items: z.array(backlogEntryInput).optional(),
			notes: z.array(backlogEntryInput).optional(),
		}),
		z.object({
			action: z.literal("backlog.edit"),
			number: backlogNumber,
			text: z.string().optional(),
			note: z.string().optional(),
		}),
		z.object({
			action: z.literal("backlog.set"),
			numbers: z.array(backlogNumber),
			done: z.boolean(),
		}),
		z.object({
			action: z.literal("backlog.remove"),
			numbers: z.array(backlogNumber),
		}),
		z.object({
			action: z.literal("backlog.move"),
			number: backlogNumber,
			targetNumber: backlogNumber,
			position: movePosition,
		}),
		z.object({
			action: z.literal("backlog.convert"),
			number: backlogNumber,
			kind: z.enum(["item", "note"]),
		}),
	]);

const toolStepSchema = (depth: number): z.ZodType<RoadmapStepInput> =>
	z.strictObject({
		id: id.optional(),
		text: shortText,
		note: note.optional(),
		done: z.boolean().optional(),
		children: z
			.array(depth > 1 ? toolStepSchema(depth - 1) : z.strictObject({}))
			.max(depth > 1 ? 100 : 0)
			.optional(),
	});

const toolBacklogEntry = z.strictObject({
	text: shortText,
	note: note.optional(),
});

export type RoadmapTool = "plan" | "check" | "backlog" | "milestone";

const planToolSchema = z.strictObject({
	action: z.enum([
		"init",
		"create",
		"patch",
		"attach",
		"steps",
		"delete",
		"step_add",
		"step_edit",
		"step_remove",
		"step_move",
		"journal",
	]),
	expectedRevision: revision,
	planId: id.optional(),
	title: z.string().min(1).max(300).optional(),
	summary: note.optional(),
	status: planStatus.optional(),
	milestone: id.nullable().optional(),
	sessionId: id.optional(),
	sessions: z.array(id).max(30).optional(),
	steps: z.array(toolStepSchema(3)).max(100).optional(),
	stepId: id.optional(),
	text: shortText.optional(),
	note: note.optional(),
	parentId: id.nullable().optional(),
	afterId: id.nullable().optional(),
	targetId: id.optional(),
	position: z.enum(["before", "after", "inside"]).optional(),
	direction: z.enum(["up", "down", "indent", "outdent"]).optional(),
});

const checkToolSchema = z.strictObject({
	expectedRevision: revision,
	planId: id,
	stepId: id.optional(),
	stepIds: z.array(id).min(1).max(100).optional(),
	done: z.boolean(),
	note: note.optional(),
	comment: note.optional(),
});

const backlogToolSchema = z.strictObject({
	action: z.enum(["add", "set", "edit", "remove", "convert", "move"]),
	expectedRevision: revision,
	items: z.array(toolBacklogEntry).max(100).optional(),
	notes: z.array(toolBacklogEntry).max(100).optional(),
	numbers: z.array(backlogNumber).min(1).max(100).optional(),
	number: backlogNumber.optional(),
	text: shortText.optional(),
	note: note.optional(),
	done: z.boolean().optional(),
	kind: z.enum(["item", "note"]).optional(),
	targetNumber: backlogNumber.optional(),
	position: movePosition.optional(),
});

const milestoneToolSchema = z.strictObject({
	action: z.enum(["vision", "create", "patch", "delete", "move"]),
	expectedRevision: revision,
	milestoneId: id.optional(),
	title: z.string().min(1).max(300).optional(),
	summary: note.optional(),
	text: note.optional(),
	status: milestoneStatus.optional(),
	targetId: id.optional(),
	position: movePosition.optional(),
});

export const roadmapToolInputSchemas = {
	plan: planToolSchema,
	check: checkToolSchema,
	backlog: backlogToolSchema,
	milestone: milestoneToolSchema,
} satisfies Record<RoadmapTool, z.ZodType>;

export const roadmapReadInputSchema = z.strictObject({
	target: z.enum(["overview", "plan", "backlog"]).optional(),
	planId: id.optional(),
	offset: z.number().int().min(0).optional(),
	limit: z.number().int().min(1).max(50).optional(),
});

export type RoadmapReadInput = z.infer<typeof roadmapReadInputSchema>;

/**
 * Translates one validated tool call into Roadmap actions. `sessionId`, when
 * known, is attached to a new plan that names no conversations of its own.
 */
export function roadmapToolToActions(
	tool: RoadmapTool,
	input: unknown,
	context: { sessionId?: string } = {},
): { expectedRevision: number; actions: RoadmapAction[] } {
	const parsed = roadmapToolInputSchemas[tool].safeParse(input);
	if (!parsed.success)
		throw new RoadmapError(
			"invalid",
			`Invalid roadmap ${tool} input: ${z.prettifyError(parsed.error)}`,
		);
	const {
		expectedRevision,
		action: name,
		...params
	} = parsed.data as {
		expectedRevision: number;
		action?: string;
	} & Record<string, unknown>;
	let action: string;
	if (tool === "check") action = "step.check";
	else if (tool === "backlog") action = `backlog.${name}`;
	else if (tool === "milestone")
		action = name === "vision" ? "vision" : `milestone.${name}`;
	else if (name === "init") action = "init";
	else if (name === "journal") action = "journal.add";
	else if (name?.startsWith("step_")) action = `step.${name.slice(5)}`;
	else action = `plan.${name}`;
	if (context.sessionId && action === "plan.create" && !params.sessions)
		params.sessions = [context.sessionId];
	if (context.sessionId && action === "backlog.add")
		for (const key of ["items", "notes"] as const)
			if (Array.isArray(params[key]))
				params[key] = (params[key] as Record<string, unknown>[]).map(
					(entry) => ({ sessions: [context.sessionId], ...entry }),
				);
	return {
		expectedRevision,
		actions: [{ ...params, action } as RoadmapAction],
	};
}

const READ_RESPONSE_BYTES = 110 * 1024;
const MAX_RESPONSE_BYTES = 120 * 1024;
const byteLength = (value: unknown) =>
	new TextEncoder().encode(JSON.stringify(value)).length;

type ViewPlan = RoadmapView["plans"][number];
type ViewStep = ViewPlan["steps"][number];

export type RoadmapAgentFlatStep = Omit<ViewStep, "children"> & {
	parentId: string | null;
	childCount: number;
};

export interface RoadmapAgentPage {
	offset: number;
	nextOffset: number | null;
	textTruncated: boolean;
}

export type RoadmapAgentRead =
	| { revision: number; plan: ViewPlan }
	| (RoadmapAgentPage & {
			revision: number;
			plan: Omit<ViewPlan, "steps"> & { sessionCount: number };
			flatSteps: RoadmapAgentFlatStep[];
			totalSteps: number;
	  })
	| (RoadmapAgentPage & {
			revision: number;
			backlog: RoadmapView["backlog"];
			totalItems: number;
			totalNotes: number;
	  })
	| (RoadmapAgentPage & {
			revision: number;
			initialized: boolean;
			vision: string;
			notes: string;
			progress: RoadmapView["progress"];
			milestones: RoadmapView["overview"]["milestones"];
			plans: (Pick<
				ViewPlan,
				| "id"
				| "title"
				| "summary"
				| "status"
				| "milestone"
				| "sessions"
				| "progress"
			> & { sessionCount: number })[];
			backlog: { itemCount: number; noteCount: number };
			planCount: number;
			milestoneCount: number;
	  });

function readProjection(
	view: RoadmapView,
	params: RoadmapReadInput,
): RoadmapAgentRead {
	const offset = params.offset ?? 0;
	const limit = params.limit ?? 30;
	if (
		!Number.isSafeInteger(offset) ||
		offset < 0 ||
		!Number.isSafeInteger(limit) ||
		limit < 1 ||
		limit > 50
	)
		throw new RoadmapError(
			"invalid",
			"Invalid Roadmap page. Use an offset >= 0 and limit between 1 and 50.",
		);
	let textTruncated = false;
	const excerpt = (value: string, maximum: number) => {
		if (value.length > maximum) textTruncated = true;
		return value.slice(0, maximum);
	};
	const page = <T extends { text: string; note?: string }>(entries: T[]) =>
		entries.slice(offset, offset + limit).map((entry) => ({
			...entry,
			text: excerpt(entry.text, 1500),
			...(entry.note === undefined ? {} : { note: excerpt(entry.note, 1000) }),
		}));
	if (params.target === "plan") {
		const plan = view.plans.find((item) => item.id === params.planId);
		if (!plan)
			throw new RoadmapError(
				"not_found",
				"Unknown plan ID. Read the overview for current references.",
			);
		// Small plans keep their hierarchy; large ones become a bounded flat page with parent ids.
		if (!offset && byteLength(plan) < READ_RESPONSE_BYTES)
			return { revision: view.revision, plan };
		const flat: (Omit<
			RoadmapView["plans"][number]["steps"][number],
			"children"
		> & {
			parentId: string | null;
			childCount: number;
		})[] = [];
		const flatten = (
			steps: RoadmapView["plans"][number]["steps"],
			parentId: string | null = null,
		) => {
			for (const { children, ...step } of steps) {
				flat.push({ ...step, parentId, childCount: children.length });
				flatten(children, step.id);
			}
		};
		flatten(plan.steps);
		const { steps: _steps, journal, summary, sessions, ...metadata } = plan;
		const flatSteps = page(flat);
		return {
			revision: view.revision,
			plan: {
				...metadata,
				sessions: sessions.slice(0, 20),
				sessionCount: sessions.length,
				summary: excerpt(summary, 2000),
				journal: journal
					.slice(-5)
					.map((entry) => ({ ...entry, text: excerpt(entry.text, 1000) })),
			},
			flatSteps,
			totalSteps: flat.length,
			offset,
			nextOffset: offset + limit < flat.length ? offset + limit : null,
			textTruncated,
		};
	}
	if (params.target === "backlog") {
		const { backlog } = view;
		const selected = {
			items: page(backlog.items),
			notes: page(backlog.notes),
			nextNumber: backlog.nextNumber,
		};
		const total = Math.max(backlog.items.length, backlog.notes.length);
		return {
			revision: view.revision,
			backlog: selected,
			totalItems: backlog.items.length,
			totalNotes: backlog.notes.length,
			offset,
			nextOffset: offset + limit < total ? offset + limit : null,
			textTruncated,
		};
	}
	const { milestones } = view.overview;
	const projection = {
		revision: view.revision,
		initialized: view.initialized,
		vision: excerpt(view.overview.vision, 3000),
		notes: excerpt(view.overview.notes, 3000),
		progress: view.progress,
		milestones: milestones
			.slice(offset, offset + limit)
			.map((item) => ({ ...item, summary: excerpt(item.summary, 500) })),
		plans: view.plans
			.slice(offset, offset + limit)
			.map(({ id, title, summary, status, milestone, sessions, progress }) => ({
				id,
				title,
				summary: excerpt(summary, 500),
				status,
				milestone,
				sessions: sessions.slice(0, 10),
				sessionCount: sessions.length,
				progress,
			})),
		backlog: {
			itemCount: view.backlog.items.length,
			noteCount: view.backlog.notes.length,
		},
		planCount: view.plans.length,
		milestoneCount: milestones.length,
		offset,
		nextOffset:
			offset + limit < Math.max(view.plans.length, milestones.length)
				? offset + limit
				: null,
	};
	return { ...projection, textTruncated };
}

/** The compact projection an agent reads: halves the page until it fits the response limit. */
export function readRoadmapForAgent(
	view: RoadmapView,
	params: RoadmapReadInput = {},
): RoadmapAgentRead {
	let limit = params.limit ?? 30;
	for (;;) {
		const result = readProjection(view, { ...params, limit });
		const size = byteLength(result);
		if (size <= READ_RESPONSE_BYTES || limit <= 1) {
			if (size > MAX_RESPONSE_BYTES)
				throw new RoadmapError(
					"too_large",
					"Roadmap response is too large. Read a specific plan or the backlog.",
				);
			return result;
		}
		limit = Math.max(1, Math.floor(limit / 2));
	}
}
