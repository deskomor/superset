import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveGitHubToken, resolveUpdateFeed } from "./update-feed";

describe("resolveUpdateFeed", () => {
	it("reads Superset's public release assets when no repository is configured", async () => {
		const feed = await resolveUpdateFeed({
			githubRepo: undefined,
			isPrerelease: false,
			resolveToken: async () => "unused",
		});
		expect(feed).toEqual({
			provider: "generic",
			url: "https://github.com/superset-sh/superset/releases/latest/download",
		});
	});

	it("reads a private repository's releases with a token, and has no feed without one", async () => {
		expect(
			await resolveUpdateFeed({
				githubRepo: "deskomor/superset-prime",
				isPrerelease: false,
				resolveToken: async () => "gho_x",
			}),
		).toEqual({
			provider: "github",
			owner: "deskomor",
			repo: "superset-prime",
			private: true,
			token: "gho_x",
		});
		expect(
			await resolveUpdateFeed({
				githubRepo: "deskomor/superset-prime",
				isPrerelease: false,
				resolveToken: async () => null,
			}),
		).toBeNull();
	});
});

describe("resolveGitHubToken", () => {
	it("prefers the environment, falls back to gh off PATH, and gives up quietly", async () => {
		const home = mkdtempSync(join(tmpdir(), "update-feed-"));
		const runGh = async () => "gho_from_gh\n";

		expect(
			await resolveGitHubToken({ GH_TOKEN: "env_token" }, runGh, home),
		).toBe("env_token");

		mkdirSync(join(home, ".local", "bin"), { recursive: true });
		writeFileSync(join(home, ".local", "bin", "gh"), "");
		expect(await resolveGitHubToken({}, runGh, home)).toBe("gho_from_gh");

		const signedOut = async () => {
			throw new Error("not logged in");
		};
		expect(await resolveGitHubToken({}, signedOut, home)).toBeNull();
	});
});
