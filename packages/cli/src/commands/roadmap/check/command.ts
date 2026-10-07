import { command } from "../../../lib/command";
import { runRoadmapTool, toolOptions } from "../shared";

export default command({
	description: "Check or uncheck tasks of a Roadmap plan (JSON via --input)",
	options: toolOptions("check"),
	skipMiddleware: true,
	run: ({ options }) => runRoadmapTool("check", options),
});
