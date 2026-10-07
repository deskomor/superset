import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type UpdateFeed =
	| { provider: "generic"; url: string }
	| {
			provider: "github";
			owner: string;
			repo: string;
			private: true;
			token: string;
	  };

/**
 * Where updates come from. Upstream builds read Superset's public release
 * assets. A build with `SUPERSET_UPDATE_GITHUB_REPO` ("owner/repo") reads that
 * repository's latest release through the GitHub API instead, which a private
 * repository needs; with no token there is no feed, and the check is skipped.
 */
export async function resolveUpdateFeed(options: {
	githubRepo: string | undefined;
	isPrerelease: boolean;
	resolveToken: () => Promise<string | null>;
}): Promise<UpdateFeed | null> {
	const [owner, repo] = (options.githubRepo ?? "").split("/");
	if (!owner || !repo) {
		return {
			provider: "generic",
			url: options.isPrerelease
				? "https://github.com/superset-sh/superset/releases/download/desktop-canary"
				: "https://github.com/superset-sh/superset/releases/latest/download",
		};
	}
	const token = await options.resolveToken();
	return token
		? { provider: "github", owner, repo, private: true, token }
		: null;
}

export async function resolveGitHubToken(
	env: NodeJS.ProcessEnv = process.env,
	runGh: (gh: string) => Promise<string> = async (gh) =>
		(await execFileAsync(gh, ["auth", "token"], { timeout: 5_000 })).stdout,
	home: string = homedir(),
): Promise<string | null> {
	const fromEnv = env.GH_TOKEN?.trim() || env.GITHUB_TOKEN?.trim();
	if (fromEnv) return fromEnv;
	// A launcher-started app gets a minimal PATH without ~/.local/bin or
	// Homebrew, so `gh` is looked up at its usual install locations.
	for (const gh of [
		join(home, ".local", "bin", "gh"),
		"/usr/local/bin/gh",
		"/usr/bin/gh",
		"/opt/homebrew/bin/gh",
		"/home/linuxbrew/.linuxbrew/bin/gh",
	]) {
		if (!existsSync(gh)) continue;
		try {
			const token = (await runGh(gh)).trim();
			if (token) return token;
		} catch {
			// Signed out or broken install: try the next one, then give up.
		}
	}
	return null;
}
