import fs from "node:fs";
import path from "node:path";
import {
	removeOwnedFileIfMarked,
	writeFileIfChanged,
} from "./agent-wrappers-common";
import { getTemplatePath } from "./config";
import { getPrimeAgentDir } from "./paths";

export const PRIME_AGENT_EXTENSION_FILE = "superset-hooks.ts";

const PRIME_AGENT_EXTENSION_SIGNATURE = "// Superset Prime Agent extension";
const PRIME_AGENT_EXTENSION_VERSION = "v1";
export const PRIME_AGENT_EXTENSION_MARKER = `${PRIME_AGENT_EXTENSION_SIGNATURE} ${PRIME_AGENT_EXTENSION_VERSION}`;

/** Prime Agent auto-discovers global extensions in `<agent dir>/extensions/`. */
export function getPrimeAgentExtensionPath(): string {
	return path.join(
		getPrimeAgentDir(),
		"extensions",
		PRIME_AGENT_EXTENSION_FILE,
	);
}

export function getPrimeAgentExtensionContent(): string {
	const template = fs.readFileSync(
		getTemplatePath("prime-agent-extension.template.ts"),
		"utf-8",
	);
	return template.replace("{{MARKER}}", PRIME_AGENT_EXTENSION_MARKER);
}

export function createPrimeAgentExtension(): void {
	const extensionPath = getPrimeAgentExtensionPath();
	fs.mkdirSync(path.dirname(extensionPath), { recursive: true });
	const changed = writeFileIfChanged(
		extensionPath,
		getPrimeAgentExtensionContent(),
		0o644,
	);
	console.log(
		`[agent-setup] ${changed ? "Updated" : "Verified"} Prime Agent extension`,
	);
}

export function removePrimeAgentExtension(): void {
	removeOwnedFileIfMarked(
		getPrimeAgentExtensionPath(),
		PRIME_AGENT_EXTENSION_SIGNATURE,
		"Prime Agent extension",
	);
}
