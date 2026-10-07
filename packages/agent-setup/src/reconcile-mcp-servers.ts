import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PluginMcpServerConfig } from "@superset/shared/plugins";
import {
	CODEX_MARKER_END,
	CODEX_MARKER_START,
	hashMcpServerValue,
	primeAgentServerName,
	type SyncManagedMcpServersOptions,
	syncManagedMcpServers,
	toPrimeAgentServerValue,
} from "./managed-mcp-servers";
import { getPrimeAgentDir, resolveSupersetHomeDir } from "./paths";

export interface McpReconcileReport {
	agent: "claude" | "codex" | "prime-agent";
	/** Entries we own that the config does not carry, or carries with another value. */
	stale: string[];
	wrote: boolean;
}

/** Which agents materialize plugin MCP entries. Skills reach every agent; this does not. */
const AGENTS = ["claude", "codex", "prime-agent"] as const;

function readTracked(supersetHomeDir: string, filePath: string) {
	try {
		const ledger = JSON.parse(
			fs.readFileSync(
				path.join(supersetHomeDir, "plugins", "mcp-ledger.json"),
				"utf-8",
			),
		);
		return (ledger?.files?.[filePath] ?? {}) as Record<string, string>;
	} catch {
		// No ledger: we have written nothing, so every desired entry is stale.
		return {};
	}
}

function claudeStale(
	desired: Record<string, PluginMcpServerConfig>,
	homeDir: string,
	supersetHomeDir: string,
): string[] {
	const claudePath = path.join(homeDir, ".claude.json");
	let current: Record<string, unknown> = {};
	try {
		const root = JSON.parse(fs.readFileSync(claudePath, "utf-8"));
		if (root && typeof root === "object" && !Array.isArray(root)) {
			const servers = (root as { mcpServers?: unknown }).mcpServers;
			if (servers && typeof servers === "object")
				current = servers as Record<string, unknown>;
		}
	} catch {
		// No file, or unreadable: everything we want is missing.
	}
	const tracked = readTracked(supersetHomeDir, claudePath);
	const wrong = Object.entries(desired)
		.filter(([name, config]) => {
			if (!(name in current)) return true;
			// Only ours is ours to correct. A value we did not write belongs to the
			// user, and the sync leaves it alone — so it is not stale, it is theirs.
			const ours = tracked[name];
			if (ours === undefined) return false;
			return hashMcpServerValue(current[name]) !== hashMcpServerValue(config);
		})
		.map(([name]) => name);
	// An entry we wrote that the desired set no longer names has to come out,
	// or a plugin uninstalled on the account keeps its server for good.
	const removed = Object.keys(tracked).filter(
		(name) => !(name in desired) && name in current,
	);
	return [...wrong, ...removed];
}

function codexStale(
	desired: Record<string, PluginMcpServerConfig>,
	homeDir: string,
): string[] {
	let text = "";
	try {
		text = fs.readFileSync(
			path.join(homeDir, ".codex", "config.toml"),
			"utf-8",
		);
	} catch {
		// Absent: every desired entry is missing.
	}
	const missing = Object.keys(desired).filter(
		(name) => !text.includes(`[mcp_servers.${name}]`),
	);
	// Same as Claude's removals, read off the managed block rather than a
	// ledger: what is fenced is what we wrote.
	const start = text.indexOf(CODEX_MARKER_START);
	const end = text.indexOf(CODEX_MARKER_END);
	const managed =
		start === -1 || end === -1
			? []
			: [
					...text.slice(start, end).matchAll(/^\[mcp_servers\.([^\]]+)\]/gm),
				].map((match) => match[1] as string);
	return [...missing, ...managed.filter((name) => !(name in desired))];
}

/** Like Claude's, but under Prime Agent's names and dialect, and only once it is installed. */
function primeAgentStale(
	desired: Record<string, PluginMcpServerConfig>,
	homeDir: string,
	supersetHomeDir: string,
): string[] {
	const agentDir = getPrimeAgentDir(homeDir);
	if (!fs.existsSync(agentDir)) return [];
	const filePath = path.join(agentDir, "settings.json");
	let current: Record<string, unknown> = {};
	try {
		const servers = JSON.parse(fs.readFileSync(filePath, "utf-8"))?.mcpServers;
		if (servers && typeof servers === "object") current = servers;
	} catch {
		// No file, or unreadable: everything we want is missing.
	}
	const tracked = readTracked(supersetHomeDir, filePath);
	const expected: Record<string, unknown> = {};
	for (const [name, config] of Object.entries(desired)) {
		const value = toPrimeAgentServerValue(config, supersetHomeDir);
		if (value) expected[primeAgentServerName(name)] = value;
	}
	const wrong = Object.entries(expected)
		.filter(([name, value]) => {
			if (!(name in current)) return true;
			if (tracked[name] === undefined) return false;
			return hashMcpServerValue(current[name]) !== hashMcpServerValue(value);
		})
		.map(([name]) => name);
	const removed = Object.keys(tracked).filter(
		(name) => !(name in expected) && name in current,
	);
	return [...wrong, ...removed];
}

/**
 * Checks the supported agents' MCP configs against the desired set and writes
 * only when something is actually missing or changed.
 *
 * Writing on install alone is not enough: an install can be declined (a
 * same-named server configured elsewhere), the file can be edited afterwards,
 * and installs from the web, the CLI or a cloud box never reach the desktop
 * process that writes config at all. Running this before a session starts makes
 * the config converge wherever the install happened.
 *
 * Cheap by construction — it reads two files and compares hashes, and does no
 * work when everything is in place, which is the usual case.
 */
export function reconcileMcpServers(
	desired: Record<string, PluginMcpServerConfig>,
	options: SyncManagedMcpServersOptions = {},
): McpReconcileReport[] {
	const homeDir = options.homeDir ?? os.homedir();
	const supersetHomeDir = options.supersetHomeDir ?? resolveSupersetHomeDir();

	const stale: Record<(typeof AGENTS)[number], string[]> = {
		claude: claudeStale(desired, homeDir, supersetHomeDir),
		codex: codexStale(desired, homeDir),
		"prime-agent": primeAgentStale(desired, homeDir, supersetHomeDir),
	};
	const needsWrite = AGENTS.some((agent) => stale[agent].length > 0);

	// One writer for both dialects, because reaping is defined over the whole
	// desired set: a per-agent write would leave the other's removals behind.
	if (needsWrite) syncManagedMcpServers(desired, options);

	return AGENTS.map((agent) => ({
		agent,
		stale: stale[agent],
		wrote: needsWrite && stale[agent].length > 0,
	}));
}
