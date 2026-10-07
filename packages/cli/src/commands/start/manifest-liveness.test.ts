import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StartAuth } from "./command";

const originalSupersetHomeDir = process.env.SUPERSET_HOME_DIR;
const originalSupersetOrganizationId = process.env.SUPERSET_ORGANIZATION_ID;
const tempHome = mkdtempSync(join(tmpdir(), "superset-cli-start-"));
process.env.SUPERSET_HOME_DIR = tempHome;
// start/command.ts falls back to this env var when --org is omitted; a
// value left over from the outer shell would make org resolution fail
// before the manifest check under test ever runs.
delete process.env.SUPERSET_ORGANIZATION_ID;

// Imports below must come after SUPERSET_HOME_DIR is set: config.ts and
// manifest.ts both read it once at module load.
const { readManifest, writeManifest } = await import("../../lib/host/manifest");
const { runStart } = await import("./command");

afterAll(() => {
	if (originalSupersetHomeDir === undefined) {
		delete process.env.SUPERSET_HOME_DIR;
	} else {
		process.env.SUPERSET_HOME_DIR = originalSupersetHomeDir;
	}
	if (originalSupersetOrganizationId === undefined) {
		delete process.env.SUPERSET_ORGANIZATION_ID;
	} else {
		process.env.SUPERSET_ORGANIZATION_ID = originalSupersetOrganizationId;
	}
	rmSync(tempHome, { recursive: true, force: true });
});

const ORG = { id: "org-1", slug: "org-1", name: "Palette" };

const fakeAuth = async () =>
	({
		api: { user: { myOrganizations: { query: async () => [ORG] } } },
		bearer: "bearer-token",
		authConfigPath: undefined,
	}) as unknown as StartAuth;

type Result = { data: Record<string, unknown>; message?: string };

function run(): Promise<Result> {
	return runStart(
		{},
		new AbortController().signal,
		fakeAuth,
	) as Promise<Result>;
}

describe("superset start manifest liveness", () => {
	// "Already running" for a manifest whose pid genuinely runs the host
	// binary (live pid, command matches) is covered at the unit level in
	// lib/host/manifest-liveness.test.ts, with the identity check
	// dependency-injected instead of relying on a real spawned process and
	// `ps` — matching a genuine `superset-host` process portably from a test
	// fixture isn't reliable across environments.

	test("stale manifest with a dead pid is cleaned up and a fresh start is attempted", async () => {
		writeManifest({
			pid: 999_999,
			endpoint: "http://127.0.0.1:19995",
			authToken: "secret",
			startedAt: Date.now(),
			organizationId: ORG.id,
		});

		// No superset-host binary is installed in this test environment, so a
		// genuine spawn attempt fails — proof the "already running" branch was
		// not taken.
		await expect(run()).rejects.toThrow();
		expect(readManifest(ORG.id)).toBeNull();
	});

	test("stale manifest with a live pid belonging to a different process (pid reuse) is cleaned up and a fresh start is attempted", async () => {
		// Reproduces the bug report: a live pid alone must not be trusted as
		// evidence the manifest still describes the host service.
		writeManifest({
			pid: process.pid,
			endpoint: "http://127.0.0.1:19996",
			authToken: "secret",
			startedAt: Date.now(),
			organizationId: ORG.id,
		});

		await expect(run()).rejects.toThrow();
		expect(readManifest(ORG.id)).toBeNull();
	});
});
