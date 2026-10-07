// The module chain reads env at load (@t3-oss/env-core), so vars must be set before importing.
process.env.ORGANIZATION_ID = "00000000-0000-4000-8000-000000000000";
process.env.HOST_SERVICE_SECRET = "test-secret";
process.env.HOST_DB_PATH = "/tmp/test-host.db";
process.env.HOST_MIGRATIONS_FOLDER = "/tmp/test-migrations";
process.env.AUTH_TOKEN = "test-auth-token";
process.env.SUPERSET_API_URL = "https://cloud.example.com";

import { expect, test } from "bun:test";

test("the app router builds, so host-service can start", async () => {
	const { appRouter } = await import("./router.ts");
	expect(Object.keys(appRouter._def.procedures)).toContain(
		"roadmap.applyActions",
	);
});
