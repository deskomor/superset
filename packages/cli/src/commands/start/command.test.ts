import { describe, expect, mock, test } from "bun:test";
import { runStart, type StartAuth } from "./command";

function auth(query: () => Promise<unknown>): () => Promise<StartAuth> {
	return async () =>
		({
			api: { user: { myOrganizations: { query } } },
			bearer: "bearer-token",
			authConfigPath: undefined,
		}) as unknown as StartAuth;
}

describe("start auto-update options", () => {
	for (const daemon of [undefined, false]) {
		test(`rejects auto-update with daemon=${daemon} before querying organizations`, async () => {
			const query = mock(async () => []);
			await expect(
				runStart(
					{ autoUpdate: true, daemon },
					new AbortController().signal,
					auth(query),
				),
			).rejects.toThrow("--auto-update requires --daemon");
			expect(query).not.toHaveBeenCalled();
		});
	}

	for (const options of [
		{ autoUpdate: true, daemon: true },
		{ autoUpdate: false, daemon: false },
		{ autoUpdate: undefined, daemon: undefined },
	]) {
		test(`allows ${JSON.stringify(options)} through to organization lookup`, async () => {
			const lookupError = new Error("Organization lookup reached");
			const query = mock(async () => {
				throw lookupError;
			});
			await expect(
				runStart(options, new AbortController().signal, auth(query)),
			).rejects.toBe(lookupError);
			expect(query).toHaveBeenCalledTimes(1);
		});
	}
});
