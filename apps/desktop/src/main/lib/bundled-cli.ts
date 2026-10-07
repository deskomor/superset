import {
	chmodSync,
	closeSync,
	copyFileSync,
	existsSync,
	lstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	readSync,
	renameSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { getBinDir } from "@superset/agent-setup/paths";
import { app } from "electron";

export const BUNDLED_CLI_SHIM_MARKER = "# Superset bundled CLI shim v1";
const SHIM_HEADER_BYTES = 2048;

export type BundledCliInstallStatus = "installed" | "missing" | "skipped";

interface InstallBundledCliShimOptions {
	binDir?: string;
	bundledCliPath?: string | null;
	platform?: NodeJS.Platform;
	/**
	 * Where to keep a copy of the CLI that outlives this launch. An AppImage
	 * serves its files from a mount that disappears when the app quits, so a
	 * shim pointing into it breaks every `superset` call in surviving terminals.
	 */
	stableDir?: string | null;
}

/** Copies the CLI to `stableDir` when the bundled one changed, and returns the copy. */
export function copyBundledCliToStableDir(
	bundledCliPath: string,
	stableDir: string,
	platform: NodeJS.Platform = process.platform,
): string {
	const target = path.join(stableDir, getBundledCliBinaryName(platform));
	const stampPath = `${target}.source`;
	const source = statSync(bundledCliPath);
	const stamp = `${source.size}:${source.mtimeMs}`;
	const current =
		existsSync(target) && existsSync(stampPath)
			? readFileSync(stampPath, "utf-8")
			: null;
	if (current === stamp) return target;

	mkdirSync(stableDir, { recursive: true });
	const temp = `${target}.${process.pid}.tmp`;
	copyFileSync(bundledCliPath, temp);
	chmodSync(temp, 0o755);
	renameSync(temp, target);
	writeFileSync(stampPath, stamp);
	return target;
}

export function getBundledCliBinaryName(
	platform: NodeJS.Platform = process.platform,
): string {
	return platform === "win32" ? "superset.exe" : "superset";
}

export function getBundledCliShimName(
	platform: NodeJS.Platform = process.platform,
): string {
	return platform === "win32" ? "superset.cmd" : "superset";
}

function quoteShellLiteral(value: string): string {
	return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function quoteCmdLiteral(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}

/**
 * A dev build talks to a dev stack, and the binary defaults to production, so
 * the addresses travel in the shim rather than being compiled into the CLI.
 */
function devStackAddresses(): Array<[string, string]> {
	if (app.isPackaged) return [];
	const api = process.env.NEXT_PUBLIC_API_URL;
	const web = process.env.NEXT_PUBLIC_WEB_URL;
	const realtime = process.env.REALTIME_URL;
	return [
		...(api ? ([["SUPERSET_API_URL", api]] as Array<[string, string]>) : []),
		...(web ? ([["SUPERSET_WEB_URL", web]] as Array<[string, string]>) : []),
		...(realtime
			? ([["REALTIME_URL", realtime]] as Array<[string, string]>)
			: []),
	];
}

export function buildBundledCliShim(
	bundledCliPath: string,
	platform: NodeJS.Platform = process.platform,
): string {
	const addresses = devStackAddresses();
	if (platform === "win32") {
		const sets = addresses
			.map(([key, value]) => `set ${key}=${value}\r\n`)
			.join("");
		return `@echo off\r\nrem ${BUNDLED_CLI_SHIM_MARKER}\r\n${sets}${quoteCmdLiteral(
			bundledCliPath,
		)} %*\r\n`;
	}

	const exports = addresses
		.map(([key, value]) => `export ${key}=${quoteShellLiteral(value)}\n`)
		.join("");
	return `#!/bin/sh
${BUNDLED_CLI_SHIM_MARKER}
${exports}exec ${quoteShellLiteral(bundledCliPath)} "$@"
`;
}

function getBundledCliCandidates(platform: NodeJS.Platform): string[] {
	const binaryName = getBundledCliBinaryName(platform);
	const candidates = [
		app.isPackaged
			? path.join(process.resourcesPath, "resources/bin", binaryName)
			: null,
		path.join(__dirname, "../resources/bin", binaryName),
		path.join(app.getAppPath(), "dist/resources/bin", binaryName),
		path.resolve(app.getAppPath(), "../../packages/cli/dist", binaryName),
	];

	return candidates.filter((candidate): candidate is string => !!candidate);
}

export function resolveBundledCliPath(
	platform: NodeJS.Platform = process.platform,
): string | null {
	return (
		getBundledCliCandidates(platform).find((candidate) =>
			existsSync(candidate),
		) ?? null
	);
}

function shouldReplaceShim(shimPath: string): boolean {
	if (!existsSync(shimPath)) return true;

	const stat = lstatSync(shimPath);
	if (!stat.isFile()) return false;

	const fd = openSync(shimPath, "r");
	try {
		const buffer = Buffer.alloc(Math.min(SHIM_HEADER_BYTES, stat.size));
		const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
		return buffer
			.toString("utf-8", 0, bytesRead)
			.includes(BUNDLED_CLI_SHIM_MARKER);
	} finally {
		closeSync(fd);
	}
}

export function installBundledCliShim(
	options: InstallBundledCliShimOptions = {},
): BundledCliInstallStatus {
	const platform = options.platform ?? process.platform;
	const bundledCliPath =
		options.bundledCliPath ?? resolveBundledCliPath(platform);

	if (!bundledCliPath || !existsSync(bundledCliPath)) {
		console.debug("[bundled-cli] No bundled CLI binary found");
		return "missing";
	}

	const binDir = options.binDir ?? getBinDir();
	const shimPath = path.join(binDir, getBundledCliShimName(platform));
	if (!shouldReplaceShim(shimPath)) {
		console.warn(
			`[bundled-cli] Skipping ${shimPath}; an unmanaged file already exists`,
		);
		return "skipped";
	}

	const stableDir =
		options.stableDir === undefined
			? process.env.APPIMAGE
				? path.join(path.dirname(binDir), "lib")
				: null
			: options.stableDir;
	const shimTarget = stableDir
		? copyBundledCliToStableDir(bundledCliPath, stableDir, platform)
		: bundledCliPath;

	mkdirSync(binDir, { recursive: true });
	if (existsSync(shimPath)) {
		unlinkSync(shimPath);
	}
	writeFileSync(shimPath, buildBundledCliShim(shimTarget, platform), {
		mode: platform === "win32" ? 0o644 : 0o755,
	});

	console.log(`[bundled-cli] Installed Superset CLI shim at ${shimPath}`);
	return "installed";
}
