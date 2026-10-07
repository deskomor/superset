import { CLIError, string } from "@superset/cli-framework";
import {
	type RoadmapTool,
	roadmapToolInputSchemas,
} from "@superset/shared/roadmap";
import { TRPCClientError } from "@trpc/client";
import { z } from "zod";
import { readConfig, resolveOrganizationId } from "../../lib/config";
import { resolveLocalHostTarget } from "../../lib/host-target";

export const scopeOptions = {
	workspace: string()
		.env("SUPERSET_WORKSPACE_ID")
		.desc("Workspace whose project's Roadmap to use"),
	project: string().desc("Project whose Roadmap to use"),
};

type JsonSchema = {
	type?: string | string[];
	enum?: unknown[];
	anyOf?: JsonSchema[];
	items?: JsonSchema;
	properties?: Record<string, JsonSchema>;
	required?: string[];
};

function describeType(schema: JsonSchema): string {
	if (schema.enum) return schema.enum.map((value) => String(value)).join("|");
	if (schema.anyOf) return schema.anyOf.map(describeType).join("|");
	if (schema.type === "array")
		return schema.items?.properties
			? `[{${Object.keys(schema.items.properties).join(",")}}]`
			: `${describeType(schema.items ?? {})}[]`;
	if (Array.isArray(schema.type)) return schema.type.join("|");
	return schema.type ?? "any";
}

export function roadmapToolFields(tool: RoadmapTool): string {
	const schema = z.toJSONSchema(roadmapToolInputSchemas[tool], {
		unrepresentable: "any",
		cycles: "ref",
		reused: "inline",
	}) as JsonSchema;
	const required = new Set(schema.required ?? []);
	return Object.entries(schema.properties ?? {})
		.map(
			([name, field]) =>
				`${name}${required.has(name) ? "" : "?"}: ${describeType(field)}`,
		)
		.join("; ");
}

export function parseToolInput(tool: RoadmapTool, raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch (error) {
		throw new CLIError(
			`--input is not valid JSON: ${(error as Error).message}`,
			`Fields: ${roadmapToolFields(tool)}`,
		);
	}
}

export function resolveRoadmapScope(options: {
	workspace?: string | null;
	project?: string | null;
}) {
	const workspaceId = options.workspace ?? undefined;
	const projectId = options.project ?? undefined;
	if (!workspaceId && !projectId)
		throw new CLIError(
			"No project selected for the Roadmap",
			"Run inside a Superset terminal or pass --workspace/--project",
		);
	const organizationId = resolveOrganizationId(readConfig());
	if (!organizationId)
		throw new CLIError(
			"No organization for this machine's host service",
			"Run inside a Superset terminal, or set SUPERSET_ORGANIZATION_ID",
		);
	const target = resolveLocalHostTarget(organizationId);
	return { client: target.client, scope: { workspaceId, projectId } };
}

export const toolOptions = (tool: RoadmapTool) => ({
	...scopeOptions,
	input: string()
		.required()
		.desc(`JSON object. Fields: ${roadmapToolFields(tool)}`),
});

export async function runRoadmapTool(
	tool: RoadmapTool,
	options: {
		workspace?: string | null;
		project?: string | null;
		input: string;
	},
) {
	const input = parseToolInput(tool, options.input);
	const { client, scope } = resolveRoadmapScope(options);
	try {
		const data = await client.roadmap.tool.mutate({
			...scope,
			tool,
			input,
			sessionId: process.env.SUPERSET_TERMINAL_ID || undefined,
		});
		return { data, message: JSON.stringify(data, null, 2) };
	} catch (error) {
		if (error instanceof TRPCClientError && error.data?.code === "BAD_REQUEST")
			throw new CLIError(error.message, `Fields: ${roadmapToolFields(tool)}`);
		throw error;
	}
}
