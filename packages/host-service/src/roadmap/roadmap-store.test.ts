import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { RoadmapError } from "@superset/shared/roadmap";
import { createRoadmapStore } from "./roadmap-store";

const user = { by: "user" } as const;
let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(path.join(tmpdir(), "roadmap-store-"));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("roadmap store", () => {
	test("a missing file reads as an uninitialized Roadmap", async () => {
		const doc = await createRoadmapStore(dir).readRoadmap("project-1");
		expect(doc.revision).toBe(0);
	});

	test("a stale revision is rejected and the file is unchanged", async () => {
		const store = createRoadmapStore(dir);
		await store.mutateRoadmap("p", 0, [{ action: "init" }], user);
		const error = await store
			.mutateRoadmap("p", 0, [{ action: "vision", text: "late" }], user)
			.catch((reason) => reason);
		expect(error).toBeInstanceOf(RoadmapError);
		expect((error as RoadmapError).code).toBe("roadmap_conflict");
		expect((error as RoadmapError).currentRevision).toBe(1);
		expect((await store.readRoadmap("p")).overview.vision).toBe("");
	});

	test("concurrent writers from separate stores are serialized by the file lock", async () => {
		const first = createRoadmapStore(dir);
		const second = createRoadmapStore(dir);
		await first.mutateRoadmap("p", 0, [{ action: "init" }], user);
		const writers = Array.from({ length: 6 }, (_, index) => {
			const store = index % 2 ? first : second;
			const add = async (): Promise<void> => {
				const { revision } = await store.readRoadmap("p");
				try {
					await store.mutateRoadmap(
						"p",
						revision,
						[{ action: "backlog.add", items: [{ text: `item ${index}` }] }],
						user,
					);
				} catch (error) {
					if ((error as RoadmapError).code !== "roadmap_conflict") throw error;
					return add();
				}
			};
			return add();
		});
		await Promise.all(writers);
		const doc = await first.readRoadmap("p");
		expect(doc.revision).toBe(7);
		expect(
			doc.backlog.items.map((item) => item.number).sort((a, b) => a - b),
		).toEqual([1, 2, 3, 4, 5, 6]);
		expect(await readdir(dir)).toEqual(["p.json"]);
		expect(
			JSON.parse(await readFile(path.join(dir, "p.json"), "utf8")).revision,
		).toBe(7);
	});
});
