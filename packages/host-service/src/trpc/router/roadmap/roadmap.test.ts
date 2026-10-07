import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// The module chain reads env at load (@t3-oss/env-core), and the Roadmap store
// takes its directory from SUPERSET_HOME_DIR at load, so set both before importing.
const home = mkdtempSync(join(tmpdir(), "superset-roadmap-router-"));
process.env.SUPERSET_HOME_DIR = home;
process.env.ORGANIZATION_ID = "00000000-0000-4000-8000-000000000000";
process.env.HOST_SERVICE_SECRET = "test-secret";
process.env.HOST_DB_PATH = "/tmp/test-host.db";
process.env.HOST_MIGRATIONS_FOLDER = "/tmp/test-migrations";
process.env.AUTH_TOKEN = "test-auth-token";
process.env.SUPERSET_API_URL = "https://cloud.example.com";

import { Database } from "bun:sqlite";
import { afterAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import type { HostDb } from "../../../db";
import * as schema from "../../../db/schema";
import type { HostServiceContext } from "../../../types";

const { createCallerFactory } = await import("../../index");
const { roadmapRouter } = await import("./roadmap");

afterAll(() => rmSync(home, { recursive: true, force: true }));

test("a workspace without a project gets its own Roadmap", async () => {
	const sqlite = new Database(":memory:");
	const db = drizzle(sqlite, { schema });
	migrate(db, {
		migrationsFolder: resolve(import.meta.dir, "../../../../drizzle"),
	});
	db.insert(schema.workspaces)
		.values({
			id: "ws-session",
			worktreePath: home,
			branch: "main",
			type: "session",
		})
		.run();
	const ctx = {
		db: db as unknown as HostDb,
		eventBus: new Proxy({}, { get: () => () => {} }),
		isAuthenticated: true,
		organizationId: "org-test",
	} as unknown as HostServiceContext;
	const caller = createCallerFactory(roadmapRouter)(ctx);

	await caller.applyActions({
		workspaceId: "ws-session",
		expectedRevision: 0,
		actions: [
			{ action: "init" },
			{ action: "backlog.add", items: [{ text: "Write the docs" }] },
		],
	});
	const { projectId, roadmap } = await caller.get({
		workspaceId: "ws-session",
	});

	expect(projectId).toBe("session-ws-session");
	expect(roadmap.backlog.items.map((item) => item.text)).toEqual([
		"Write the docs",
	]);
});
