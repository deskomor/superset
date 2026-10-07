import type { SessionSnapshot, TurnGroup } from "@superset/chat/core";
import { displayText } from "@superset/chat/core";
import type { UserMessage } from "@superset/chat/protocol";
import { userMessageText } from "../userMessageText";

/**
 * The conversation as plain text, for handing to an agent that cannot resume
 * the session itself. Only the messages: tool calls, plans and approvals are
 * the agent's own working, and replaying them as prose invites the reader to
 * treat finished work as still pending.
 */
export function buildChatHandoffTranscript(
	groups: TurnGroup[],
	snapshot: SessionSnapshot,
	agentLabel: string,
	/** Ends the transcript at this item, whose text is replaced by `text`. */
	cut?: { itemId: string; text: string },
): string {
	const lines: string[] = [];
	for (const group of groups) {
		for (const entry of group.entries) {
			if (entry.kind !== "item") continue;
			const { item } = entry;
			const cutText = item.id === cut?.itemId ? cut.text : undefined;
			if (item.kind === "user_message") {
				const text = (cutText ?? userMessageText(item as UserMessage)).trim();
				if (text) lines.push(`User: ${text}`);
			} else if (item.kind === "agent_message") {
				const text = (cutText ?? displayText(snapshot, item.id)).trim();
				if (text) lines.push(`${agentLabel}: ${text}`);
			}
			if (cutText !== undefined) return lines.join("\n\n");
		}
	}
	return lines.join("\n\n");
}
