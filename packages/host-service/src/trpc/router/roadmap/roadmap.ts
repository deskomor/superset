import {
	type Roadmap,
	type RoadmapAction,
	type RoadmapActor,
	RoadmapError,
	readRoadmapForAgent,
	roadmapActionSchema,
	roadmapMarkdown,
	roadmapReadInputSchema,
	roadmapToolToActions,
	roadmapView,
} from "@superset/shared/roadmap";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { projects, workspaces } from "../../../db/schema";
import { roadmapStore } from "../../../roadmap/roadmap-store";
import type { HostServiceContext } from "../../../types";
import { protectedProcedure, router } from "../../index";

const scopeSchema = z.object({
	workspaceId: z.string().min(1).optional(),
	projectId: z.string().min(1).optional(),
});

function resolveProjectId(
	ctx: HostServiceContext,
	scope: z.infer<typeof scopeSchema>,
): string {
	if (scope.projectId) {
		const project = ctx.db
			.select({ id: projects.id })
			.from(projects)
			.where(eq(projects.id, scope.projectId))
			.get();
		if (!project)
			throw new TRPCError({
				code: "NOT_FOUND",
				message: `Project not found: ${scope.projectId}`,
			});
		return project.id;
	}
	if (!scope.workspaceId)
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Provide a workspaceId or a projectId.",
		});
	const workspace = ctx.db
		.select({ projectId: workspaces.projectId })
		.from(workspaces)
		.where(eq(workspaces.id, scope.workspaceId))
		.get();
	if (!workspace?.projectId)
		throw new TRPCError({
			code: "NOT_FOUND",
			message: workspace
				? "This workspace has no project, so it has no Roadmap."
				: `Workspace not found: ${scope.workspaceId}`,
		});
	return workspace.projectId;
}

async function withRoadmapErrors<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (error) {
		if (!(error instanceof RoadmapError)) throw error;
		const code =
			error.code === "roadmap_conflict" || error.code === "uninitialized"
				? "CONFLICT"
				: error.code === "not_found"
					? "NOT_FOUND"
					: error.code === "busy"
						? "TOO_MANY_REQUESTS"
						: error.code === "corrupt"
							? "INTERNAL_SERVER_ERROR"
							: "BAD_REQUEST";
		throw new TRPCError({
			code,
			message:
				error.currentRevision === undefined
					? error.message
					: `${error.message} Current revision: ${error.currentRevision}.`,
			cause: error,
		});
	}
}

async function mutate(
	ctx: HostServiceContext,
	projectId: string,
	expectedRevision: number,
	actions: RoadmapAction[],
	actor: RoadmapActor,
): Promise<Roadmap> {
	const after = await roadmapStore.mutateRoadmap(
		projectId,
		expectedRevision,
		actions,
		actor,
	);
	if (after.revision === expectedRevision + 1)
		ctx.eventBus.broadcastRoadmapChanged({
			projectId,
			revision: after.revision,
			occurredAt: Date.now(),
		});
	return after;
}

/** Private per-project Roadmap stored on this host only. */
export const roadmapRouter = router({
	get: protectedProcedure.input(scopeSchema).query(({ ctx, input }) => {
		const projectId = resolveProjectId(ctx, input);
		return withRoadmapErrors(async () => ({
			projectId,
			roadmap: roadmapView(await roadmapStore.readRoadmap(projectId)),
		}));
	}),

	read: protectedProcedure
		.input(scopeSchema.extend(roadmapReadInputSchema.shape))
		.query(({ ctx, input }) => {
			const {
				workspaceId: _workspaceId,
				projectId: _projectId,
				...params
			} = input;
			const projectId = resolveProjectId(ctx, input);
			return withRoadmapErrors(async () =>
				readRoadmapForAgent(
					roadmapView(await roadmapStore.readRoadmap(projectId)),
					params,
				),
			);
		}),

	applyActions: protectedProcedure
		.input(
			scopeSchema.extend({
				expectedRevision: z.number().int().min(0),
				actions: z.array(roadmapActionSchema).min(1).max(200),
				actor: z
					.object({
						by: z.enum(["user", "agent"]),
						sessionId: z.string().optional(),
						name: z.string().optional(),
					})
					.optional(),
			}),
		)
		.mutation(({ ctx, input }) => {
			const projectId = resolveProjectId(ctx, input);
			return withRoadmapErrors(async () =>
				roadmapView(
					await mutate(
						ctx,
						projectId,
						input.expectedRevision,
						input.actions,
						input.actor ?? { by: "user" },
					),
				),
			);
		}),

	tool: protectedProcedure
		.input(
			scopeSchema.extend({
				tool: z.enum(["plan", "check", "backlog", "milestone"]),
				input: z.unknown(),
				sessionId: z.string().min(1).optional(),
			}),
		)
		.mutation(({ ctx, input }) => {
			const projectId = resolveProjectId(ctx, input);
			return withRoadmapErrors(async () => {
				const { expectedRevision, actions } = roadmapToolToActions(
					input.tool,
					input.input,
					{ sessionId: input.sessionId },
				);
				const doc = await mutate(ctx, projectId, expectedRevision, actions, {
					by: "agent",
					...(input.sessionId ? { sessionId: input.sessionId } : {}),
				});
				const [action] = actions as [RoadmapAction];
				return {
					...readRoadmapForAgent(roadmapView(doc), { target: "overview" }),
					mutation: {
						action: action.action,
						...("planId" in action
							? { planId: action.planId }
							: action.action === "plan.create"
								? { planId: doc.plans.at(-1)?.id }
								: {}),
						...("milestoneId" in action
							? { milestoneId: action.milestoneId }
							: action.action === "milestone.create"
								? { milestoneId: doc.overview.milestones.at(-1)?.id }
								: {}),
					},
				};
			});
		}),

	exportMarkdown: protectedProcedure
		.input(scopeSchema)
		.query(({ ctx, input }) => {
			const projectId = resolveProjectId(ctx, input);
			return withRoadmapErrors(async () => {
				const project = ctx.db
					.select({ name: projects.repoName })
					.from(projects)
					.where(eq(projects.id, projectId))
					.get();
				return roadmapMarkdown(
					roadmapView(await roadmapStore.readRoadmap(projectId)),
					project?.name ?? undefined,
				);
			});
		}),
});
