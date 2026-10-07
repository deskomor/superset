import { number, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { resolveRoadmapScope, scopeOptions } from "../shared";

export default command({
	description:
		"Read the Roadmap as JSON: overview, one plan's tasks or the backlog, with the revision to pass as expectedRevision",
	options: {
		...scopeOptions,
		target: string()
			.enum("overview", "plan", "backlog")
			.desc("What to read (default: overview)"),
		planId: string().desc("Plan to read with --target plan"),
		offset: number().int().min(0).desc("First item of the page"),
		limit: number().int().min(1).max(50).desc("Items per page"),
	},
	skipMiddleware: true,
	run: async ({ options }) => {
		const { client, scope } = resolveRoadmapScope(options);
		const data = await client.roadmap.read.query({
			...scope,
			target: options.target ?? undefined,
			planId: options.planId ?? undefined,
			offset: options.offset ?? undefined,
			limit: options.limit ?? undefined,
		});
		return { data, message: JSON.stringify(data, null, 2) };
	},
});
