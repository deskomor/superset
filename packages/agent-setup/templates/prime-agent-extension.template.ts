{{MARKER}}
/**
 * Superset Notification Extension for Prime Agent.
 *
 * Emits Claude-Code-compatible lifecycle hooks to Superset's notify.sh so the
 * host UI gets a working/review indicator, a completion chime, and the
 * session id that resume and fork launch with.
 *
 * Mapping:
 *   `session_start`       → `SessionStart`      → pane icon bind
 *   `agent_start`         → `UserPromptSubmit`  → working
 *   `tool_execution_end`  → `PostToolUse`       → progress signal
 *   `agent_end`           → `Stop` / `Failed`   → completion / chime
 *   `session_shutdown`    → `Stop`              → cleanup on quit/reload
 *
 * Active only inside a Superset terminal (SUPERSET_TERMINAL_ID) and only when
 * notify.sh exists. Dispatch is fire-and-forget.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface PrimeAssistantMessage {
	role?: string;
	stopReason?: string;
	errorMessage?: string;
	content?: Array<{ type?: string; text?: string }>;
}

interface PrimeHookContext {
	hasUI?: boolean;
	sessionManager?: { getSessionId?: () => string | undefined };
}

type PrimeHookHandler = (
	event: { messages?: PrimeAssistantMessage[] } | undefined,
	ctx: PrimeHookContext | undefined,
) => void;

interface PrimeExtensionApi {
	on(
		eventName:
			| "session_start"
			| "agent_start"
			| "tool_execution_end"
			| "agent_end"
			| "session_shutdown",
		handler: PrimeHookHandler,
	): void;
}

export default function (pi: PrimeExtensionApi) {
	if (!process.env.SUPERSET_TERMINAL_ID) return;

	const supersetHome =
		process.env.SUPERSET_HOME_DIR || join(homedir(), ".superset");
	const notifyScript = join(supersetHome, "hooks", "notify.sh");
	if (!existsSync(notifyScript)) return;

	const fire = (
		eventName: string,
		ctx: PrimeHookContext | undefined,
		message?: string,
	) => {
		try {
			let sessionId: string | undefined;
			try {
				sessionId = ctx?.sessionManager?.getSessionId?.();
			} catch {
				sessionId = undefined;
			}
			const child = spawn(notifyScript, [], {
				stdio: ["pipe", "ignore", "ignore"],
				detached: true,
				env: { ...process.env, SUPERSET_HOOK_HARNESS: "prime-agent" },
			});
			child.on("error", () => {});
			child.stdin?.on("error", () => {});
			child.stdin?.end(
				JSON.stringify({
					hook_event_name: eventName,
					...(sessionId ? { session_id: sessionId } : {}),
					...(message ? { message: message.slice(0, 4000) } : {}),
				}),
			);
			child.unref();
		} catch {
			// spawn() can throw synchronously (EACCES, ENOENT).
		}
	};

	// Print (`-p`) and JSON modes report hasUI=false: subagents and one-shot
	// helpers must not drive the pane's working indicator.
	const skip = (ctx: PrimeHookContext | undefined) => ctx?.hasUI === false;

	pi.on("session_start", (_event, ctx) => {
		if (!skip(ctx)) fire("SessionStart", ctx);
	});
	pi.on("agent_start", (_event, ctx) => {
		if (!skip(ctx)) fire("UserPromptSubmit", ctx);
	});
	pi.on("tool_execution_end", (_event, ctx) => {
		if (!skip(ctx)) fire("PostToolUse", ctx);
	});
	pi.on("agent_end", (event, ctx) => {
		if (skip(ctx)) return;
		const assistant = event?.messages?.findLast(
			(message) => message.role === "assistant",
		);
		const failed = assistant?.stopReason === "error";
		const text = assistant?.content
			?.filter((part) => part.type === "text")
			.map((part) => part.text ?? "")
			.join("\n");
		fire(failed ? "Failed" : "Stop", ctx, failed ? assistant?.errorMessage : text);
	});
	pi.on("session_shutdown", (_event, ctx) => {
		if (!skip(ctx)) fire("Stop", ctx);
	});
}
