import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	isJSONRPCRequest,
	isJSONRPCResultResponse,
	type JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";
import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { getApiUrl } from "../../../lib/config";
import { resolveAuth } from "../../../lib/resolve-auth";
import { parsePluginEndpoint } from "./plugin-endpoint";

export default command({
	description:
		"Serve one of Superset's plugin MCP endpoints over stdio (for agents without a headers helper)",
	// Public and hidden for the same reason as `auth mcp-headers`: an agent
	// launches this from its MCP config, never a person.
	audience: "public",
	hidden: true,
	// A cloud workspace gets the plain HTTP entry: its firewall attaches the
	// credential, so there is nothing to proxy.
	sandbox: false,
	args: [positional("url").desc("Plugin MCP endpoint URL").required()],
	options: {},
	run: async ({ args, signal }) => {
		const endpoint = parsePluginEndpoint(args.url as string, getApiUrl());

		// Auth is resolved per request, not once at startup: the agent keeps
		// this process for its whole session, longer than an OAuth token lives.
		const http = new StreamableHTTPClientTransport(endpoint, {
			fetch: async (input, init) => {
				const { bearer } = await resolveAuth(undefined);
				const headers = new Headers(init?.headers);
				if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
				return fetch(input, { ...init, headers });
			},
		});
		const stdio = new StdioServerTransport();

		let closing = false;
		const closed = new Promise<void>((resolve) => {
			const close = () => {
				closing = true;
				resolve();
			};
			stdio.onclose = close;
			http.onclose = close;
			signal?.addEventListener("abort", close, { once: true });
			// The SDK's stdio transport never reports stdin closing; an agent
			// that drops the pipe without killing us would leave us running.
			process.stdin.once("end", close);
		});

		stdio.onmessage = (message: JSONRPCMessage) => {
			http.send(message).catch((error: unknown) => {
				if (!isJSONRPCRequest(message)) return;
				void stdio.send({
					jsonrpc: "2.0",
					id: message.id,
					error: {
						code: -32603,
						message: error instanceof Error ? error.message : String(error),
					},
				});
			});
		};
		http.onmessage = (message: JSONRPCMessage) => {
			if (
				isJSONRPCResultResponse(message) &&
				typeof message.result.protocolVersion === "string"
			) {
				http.setProtocolVersion(message.result.protocolVersion);
			}
			void stdio.send(message);
		};
		http.onerror = (error) => {
			// Closing aborts the open SSE stream, which reports as an error.
			if (closing) return;
			process.stderr.write(`[superset mcp-proxy] ${error.message}\n`);
		};

		await http.start();
		await stdio.start();
		await closed;
		await Promise.allSettled([http.close(), stdio.close()]);
		return undefined;
	},
});
