import { expect, test } from "bun:test";
import { waitForTerminalAgent } from "./waitForTerminalAgent";

type Client = Parameters<typeof waitForTerminalAgent>[0]["client"];

test("ignores other terminals while waiting for the launched terminal", async () => {
	let calls = 0;
	const client = {
		terminalAgents: {
			listByWorkspace: {
				query: async () => {
					calls++;
					return calls === 1
						? [{ terminalId: "other", agentId: "claude" }]
						: [{ terminalId: "launched", agentId: "codex" }];
				},
			},
		},
	} as unknown as Client;
	const binding = await waitForTerminalAgent({
		client,
		workspaceId: "workspace",
		terminalId: "launched",
	});
	expect(binding?.terminalId).toBe("launched");
	expect(calls).toBe(2);
});

test("stops waiting when registration times out", async () => {
	const client = {
		terminalAgents: { listByWorkspace: { query: async () => [] } },
	} as unknown as Client;
	expect(
		await waitForTerminalAgent({
			client,
			workspaceId: "workspace",
			terminalId: "missing",
			timeoutMs: 1,
		}),
	).toBeUndefined();
});
