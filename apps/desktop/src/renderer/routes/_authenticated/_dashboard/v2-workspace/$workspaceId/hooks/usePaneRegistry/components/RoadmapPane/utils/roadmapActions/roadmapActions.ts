import type {
	RoadmapAction,
	RoadmapBacklogNote,
} from "@superset/shared/roadmap";

export type MoveDirection = "up" | "down";

const PLAN_TITLE_MAX = 300;

export function adjacentMove<T>(
	entries: readonly T[],
	index: number,
	direction: MoveDirection,
): { target: T; position: "before" | "after" } | null {
	const target = entries[direction === "up" ? index - 1 : index + 1];
	if (index < 0 || target === undefined) return null;
	return { target, position: direction === "up" ? "before" : "after" };
}

export function backlogToPlanActions(
	entry: Pick<RoadmapBacklogNote, "number" | "text" | "note" | "sessions">,
): RoadmapAction[] {
	const [firstLine = ""] = entry.text.trim().split("\n");
	const title = firstLine.trim().slice(0, PLAN_TITLE_MAX).trim();
	const keepsWholeText = title === entry.text.trim();
	const summary = [keepsWholeText ? "" : entry.text.trim(), entry.note.trim()]
		.filter(Boolean)
		.join("\n\n");
	return [
		{
			action: "plan.create",
			title,
			...(summary ? { summary } : {}),
			...(entry.sessions.length ? { sessions: entry.sessions } : {}),
		},
		{ action: "backlog.remove", numbers: [entry.number] },
	];
}
