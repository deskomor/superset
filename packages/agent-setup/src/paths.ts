import os from "node:os";
import path from "node:path";

/**
 * Canonical Superset home directory resolution, shared by every process that
 * provisions or consumes ~/.superset artifacts (Electron main, host-service,
 * CLI). Resolved lazily because the desktop rewrites SUPERSET_HOME_DIR into
 * process.env during boot (dev-workspace builds use ~/.superset-<workspace>),
 * and headless hosts may not have it set at all.
 */
export function resolveSupersetHomeDir(): string {
	return (
		process.env.SUPERSET_HOME_DIR?.trim() ||
		path.join(os.homedir(), ".superset")
	);
}

export function getBinDir(): string {
	return path.join(resolveSupersetHomeDir(), "bin");
}

export function getHooksDir(): string {
	return path.join(resolveSupersetHomeDir(), "hooks");
}

export function getZshDir(): string {
	return path.join(resolveSupersetHomeDir(), "zsh");
}

export function getBashDir(): string {
	return path.join(resolveSupersetHomeDir(), "bash");
}

export function getOpenCodeConfigDir(): string {
	return path.join(getHooksDir(), "opencode");
}

export function getOpenCodePluginDir(): string {
	return path.join(getOpenCodeConfigDir(), "plugin");
}

/** Honors `PRIME_AGENT_CODING_AGENT_DIR`, which Prime Agent reads in place of `~/.prime/agent`. */
export function getPrimeAgentDir(homeDir: string = os.homedir()): string {
	const configured = process.env.PRIME_AGENT_CODING_AGENT_DIR?.trim();
	return configured
		? configured.replace(/^~(?=$|[\\/])/, homeDir)
		: path.join(homeDir, ".prime", "agent");
}
