import { CLIError } from "@superset/cli-framework";

/**
 * The proxy attaches the user's bearer to every request, so it only talks to
 * Superset's own plugin endpoints: an edited agent config must not redirect it.
 */
export function parsePluginEndpoint(value: string, apiUrl: string): URL {
	let endpoint: URL;
	try {
		endpoint = new URL(value);
	} catch {
		throw new CLIError(`Not a URL: ${value}`);
	}
	if (
		endpoint.origin !== new URL(apiUrl).origin ||
		!endpoint.pathname.startsWith("/mcp/plugins/")
	) {
		throw new CLIError(
			`Refusing to proxy ${endpoint.origin}${endpoint.pathname}: not a Superset plugin endpoint`,
		);
	}
	return endpoint;
}
