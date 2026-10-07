import { describe, expect, test } from "bun:test";
import { buildCreateFromSelectionPrompt } from "./prompts";
import {
	applyRoadmapAction,
	applyRoadmapActions,
	emptyRoadmap,
	type Roadmap,
	RoadmapError,
	type RoadmapStepInput,
	roadmapView,
} from "./roadmap";
import { roadmapToolToActions } from "./tools";

const user = { by: "user" } as const;

function initialized(): Roadmap {
	return applyRoadmapAction(emptyRoadmap(), { action: "init" }, user, 1);
}

function withPlan(steps: RoadmapStepInput[]) {
	const doc = applyRoadmapAction(
		initialized(),
		{ action: "plan.create", title: "Ship it", steps },
		user,
		2,
	);
	return { doc, plan: doc.plans[0] as Roadmap["plans"][number] };
}

function errorCode(run: () => unknown) {
	try {
		run();
	} catch (error) {
		return error instanceof RoadmapError ? error.code : "other";
	}
	return null;
}

describe("roadmap", () => {
	test("a stale expected revision is a conflict and changes nothing", () => {
		const doc = initialized();
		expect(
			errorCode(() =>
				applyRoadmapActions(doc, [{ action: "vision", text: "x" }], user, {
					expectedRevision: 0,
				}),
			),
		).toBe("roadmap_conflict");
		expect(doc.overview.vision).toBe("");
	});

	test("a parent step is done exactly when all its children are", () => {
		const { doc, plan } = withPlan([
			{ text: "parent", children: [{ text: "a" }, { text: "b" }] },
		]);
		const [a, b] = (plan.steps[0] as Roadmap["plans"][number]["steps"][number])
			.children;
		const once = applyRoadmapAction(
			doc,
			{ action: "step.check", planId: plan.id, stepId: a?.id, done: true },
			user,
		);
		const partial = roadmapView(once).plans[0]?.steps[0];
		expect(partial?.done).toBe(false);
		expect(partial?.partial).toBe(true);
		const both = applyRoadmapAction(
			once,
			{ action: "step.check", planId: plan.id, stepId: b?.id, done: true },
			user,
		);
		expect(both.plans[0]?.steps[0]?.done).toBe(true);
		expect(roadmapView(both).progress).toEqual({
			done: 2,
			total: 2,
			percent: 100,
		});
	});

	test("a checklist is limited to three levels", () => {
		const { doc, plan } = withPlan([
			{ text: "1", children: [{ text: "2", children: [{ text: "3" }] }] },
		]);
		const third = plan.steps[0]?.children[0]?.children[0];
		expect(
			errorCode(() =>
				applyRoadmapAction(
					doc,
					{
						action: "step.add",
						planId: plan.id,
						text: "4",
						parentId: third?.id,
					},
					user,
				),
			),
		).toBe("invalid");
	});

	test("backlog numbers are never reused after removal", () => {
		const added = applyRoadmapAction(
			initialized(),
			{ action: "backlog.add", items: [{ text: "one" }, { text: "two" }] },
			user,
		);
		const removed = applyRoadmapAction(
			added,
			{ action: "backlog.remove", numbers: [2] },
			user,
		);
		const again = applyRoadmapAction(
			removed,
			{ action: "backlog.add", items: [{ text: "three" }] },
			user,
		);
		expect(again.backlog.items.map((item) => item.number)).toEqual([1, 3]);
	});

	test("converting a backlog item to a plan is one atomic change", () => {
		const added = applyRoadmapAction(
			initialized(),
			{ action: "backlog.add", items: [{ text: "Big thing", note: "why" }] },
			user,
		);
		const converted = applyRoadmapActions(
			added,
			[
				{ action: "plan.create", title: "Big thing", summary: "why" },
				{ action: "backlog.remove", numbers: [1] },
			],
			user,
			{ expectedRevision: added.revision },
		);
		expect(converted.revision).toBe(added.revision + 1);
		expect(converted.plans.map((plan) => plan.title)).toEqual(["Big thing"]);
		expect(converted.backlog.items).toEqual([]);
	});

	test("a backlog item converts to a note and back without losing its number", () => {
		const added = applyRoadmapAction(
			initialized(),
			{ action: "backlog.add", items: [{ text: "idea" }] },
			user,
		);
		const note = applyRoadmapAction(
			added,
			{ action: "backlog.convert", number: 1, kind: "note" },
			user,
		);
		expect(note.backlog.notes.map((entry) => entry.number)).toEqual([1]);
		expect("done" in (note.backlog.notes[0] ?? {})).toBe(false);
	});

	test("a bulk check fails whole when one step is unknown", () => {
		const { doc, plan } = withPlan([{ text: "a" }, { text: "b" }]);
		const input = {
			expectedRevision: doc.revision,
			planId: plan.id,
			stepIds: [plan.steps[0]?.id, "step-missing"],
			done: true,
		};
		const { actions, expectedRevision } = roadmapToolToActions("check", input);
		expect(
			errorCode(() =>
				applyRoadmapActions(doc, actions, user, { expectedRevision }),
			),
		).toBe("not_found");
		const valid = roadmapToolToActions("check", {
			...input,
			stepIds: plan.steps.map((step) => step.id),
		});
		const checked = applyRoadmapActions(doc, valid.actions, user);
		expect(checked.plans[0]?.steps.every((step) => step.done)).toBe(true);
		expect(checked.revision).toBe(doc.revision + 1);
	});

	test("selection prompts point at the superset roadmap CLI", () => {
		expect(
			buildCreateFromSelectionPrompt({ kind: "task", selection: "fix it" }),
		).toContain("superset roadmap backlog");
		expect(
			buildCreateFromSelectionPrompt({ kind: "plan", selection: "build it" }),
		).toContain("planf3");
	});
});
