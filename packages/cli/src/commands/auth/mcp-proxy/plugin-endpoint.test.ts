import { describe, expect, it } from "bun:test";
import { parsePluginEndpoint } from "./plugin-endpoint";

const API = "https://api.superset.sh";

describe("parsePluginEndpoint", () => {
	it("accepts a plugin endpoint on the Superset API, connection pin included", () => {
		const url = `${API}/mcp/plugins/superset/linear?connection=conn-1`;
		expect(parsePluginEndpoint(url, API).href).toBe(url);
	});

	it("refuses another origin, so the bearer cannot be sent elsewhere", () => {
		for (const url of [
			"https://evil.example/mcp/plugins/superset/linear",
			"https://api.superset.sh.evil.example/mcp/plugins/superset/linear",
			"http://api.superset.sh/mcp/plugins/superset/linear",
		]) {
			expect(() => parsePluginEndpoint(url, API)).toThrow("Refusing to proxy");
		}
	});

	it("refuses a Superset path outside the plugin endpoints", () => {
		expect(() => parsePluginEndpoint(`${API}/trpc/user.me`, API)).toThrow(
			"Refusing to proxy",
		);
	});
});
