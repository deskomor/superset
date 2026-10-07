import { describe, expect, test } from "bun:test";
import {
	applyRoadmapActions,
	emptyRoadmap,
	type Roadmap,
} from "@superset/shared/roadmap";
import { adjacentMove, backlogToPlanActions } from "./roadmapActions";

describe("adjacentMove", () => {
	const entries = ["a", "b", "c"];

	test("moves before the previous entry and after the next one", () => {
		expect(adjacentMove(entries, 1, "up")).toEqual({
			target: "a",
			position: "before",
		});
		expect(adjacentMove(entries, 1, "down")).toEqual({
			target: "c",
			position: "after",
		});
	});

	test("returns null at either end of the list", () => {
		expect(adjacentMove(entries, 0, "up")).toBeNull();
		expect(adjacentMove(entries, 2, "down")).toBeNull();
		expect(adjacentMove(entries, -1, "down")).toBeNull();
	});
});

describe("backlogToPlanActions", () => {
	function backlogWith(text: string, note = ""): Roadmap {
		return applyRoadmapActions(
			emptyRoadmap(),
			[
				{ action: "init" },
				{ action: "backlog.add", items: [{ text, note, sessions: ["t-1"] }] },
			],
			{ by: "user" },
		);
	}

	test("turns a backlog entry into a plan that keeps its note and conversations", () => {
		const doc = backlogWith("Ship dark mode", "Match the system theme");
		const [entry] = doc.backlog.items;
		if (!entry) throw new Error("missing entry");
		const next = applyRoadmapActions(
			doc,
			backlogToPlanActions(entry),
			{ by: "user" },
			{ expectedRevision: doc.revision },
		);
		expect(next.backlog.items).toEqual([]);
		expect(next.plans).toHaveLength(1);
		expect(next.plans[0]).toMatchObject({
			title: "Ship dark mode",
			summary: "Match the system theme",
			sessions: ["t-1"],
		});
	});

	test("keeps the full text in the summary when it does not fit the title", () => {
		const long = `${"x".repeat(400)}\nsecond line`;
		const doc = backlogWith(long, "note");
		const [entry] = doc.backlog.items;
		if (!entry) throw new Error("missing entry");
		const next = applyRoadmapActions(doc, backlogToPlanActions(entry), {
			by: "user",
		});
		expect(next.plans[0]?.title).toBe("x".repeat(300));
		expect(next.plans[0]?.summary).toBe(`${long}\n\nnote`);
	});
});
