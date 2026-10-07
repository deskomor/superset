import { existsSync } from "node:fs";
import { join } from "node:path";
import { getPrimeAgentDir } from "@superset/agent-setup/paths";
import type { HarnessSessionStore } from "./types";

/** Prime Agent keeps every session in one flat directory as `<session id>.jsonl`. */
export const primeAgentSessionStore: HarnessSessionStore = {
	hasSession({ sessionId }) {
		const root = join(getPrimeAgentDir(), "sessions");
		if (!existsSync(root)) return null;
		return existsSync(join(root, `${sessionId}.jsonl`));
	},
};
