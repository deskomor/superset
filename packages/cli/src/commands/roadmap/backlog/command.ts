import { command } from "../../../lib/command";
import { runRoadmapTool, toolOptions } from "../shared";

export default command({
	description:
		"Add, edit, check, move or convert Roadmap backlog entries (JSON via --input)",
	options: toolOptions("backlog"),
	skipMiddleware: true,
	run: ({ options }) => runRoadmapTool("backlog", options),
});
