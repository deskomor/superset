import { command } from "../../../lib/command";
import { runRoadmapTool, toolOptions } from "../shared";

export default command({
	description:
		"Create, change or plan a Roadmap plan and its tasks (JSON via --input)",
	options: toolOptions("plan"),
	skipMiddleware: true,
	run: ({ options }) => runRoadmapTool("plan", options),
});
