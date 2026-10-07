import { command } from "../../../lib/command";
import { runRoadmapTool, toolOptions } from "../shared";

export default command({
	description:
		"Set the vision or create, change and move Roadmap milestones (JSON via --input)",
	options: toolOptions("milestone"),
	skipMiddleware: true,
	run: ({ options }) => runRoadmapTool("milestone", options),
});
