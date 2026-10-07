import { command } from "../../../lib/command";
import { resolveRoadmapScope, scopeOptions } from "../shared";

export default command({
	description: "Print the Roadmap as Markdown",
	options: scopeOptions,
	skipMiddleware: true,
	run: async ({ options }) => {
		const { client, scope } = resolveRoadmapScope(options);
		const markdown = await client.roadmap.exportMarkdown.query(scope);
		return { data: { markdown }, message: markdown };
	},
});
