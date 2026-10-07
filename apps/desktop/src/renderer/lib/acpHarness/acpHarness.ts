/**
 * Preset id — not a config id — to the harness that runs it as a chat. The two
 * are different spaces: a config id is a per-user UUID, and every lookup here
 * takes the preset the config was built from.
 *
 * Mirrors the harnesses the host registers. An agent listed here that the host
 * cannot run is worse than an omission: its terminal is replaced by a chat
 * whose session never starts.
 */
const ACP_HARNESS_BY_PRESET: Record<string, string> = {
	claude: "claude-acp",
	codex: "codex-acp",
	opencode: "opencode-acp",
	pi: "pi-acp",
	"prime-agent": "prime-agent-acp",
};

export function acpHarnessForPreset(
	presetId: string | null | undefined,
): string | undefined {
	return presetId ? ACP_HARNESS_BY_PRESET[presetId] : undefined;
}

/**
 * Presets whose agent cannot `session/load`. A chat started over ACP works,
 * but a session begun in the terminal would reopen as an empty chat.
 */
const PRESETS_WITHOUT_SESSION_LOAD: Record<string, true> = {
	"prime-agent": true,
};

export function acpHarnessLoadsSessions(
	presetId: string | null | undefined,
): boolean {
	return Boolean(
		presetId &&
			ACP_HARNESS_BY_PRESET[presetId] &&
			!PRESETS_WITHOUT_SESSION_LOAD[presetId],
	);
}
