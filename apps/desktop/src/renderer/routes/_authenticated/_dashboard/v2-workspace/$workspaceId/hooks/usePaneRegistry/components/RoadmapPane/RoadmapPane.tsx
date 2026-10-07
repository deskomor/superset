import { Trans, useLingui } from "@lingui/react/macro";
import { errorMessage } from "@superset/i18n/errors";
import { buildRoadmapWorkPrompt } from "@superset/shared/roadmap";
import { Button } from "@superset/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { toast } from "@superset/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@superset/ui/tabs";
import { workspaceTrpc } from "@superset/workspace-client";
import { useEffect, useMemo } from "react";
import { LuClipboardCopy, LuEllipsis } from "react-icons/lu";
import { useWorkspaceHostUrl } from "renderer/hooks/host-service/useWorkspaceHostUrl";
import { getHostEventBus } from "renderer/lib/host-event-bus";
import type { CreateNewAgentSession } from "../../../useAgentSessionLauncher";
import { BacklogView } from "./components/BacklogView";
import { NotesView } from "./components/NotesView";
import { ProjectView } from "./components/ProjectView";
import { RoadmapUnavailable } from "./components/RoadmapUnavailable";
import { useRoadmapApply } from "./hooks/useRoadmapApply";
import {
	type RoadmapContextValue,
	type RoadmapLiveTerminal,
	RoadmapProvider,
} from "./providers/RoadmapProvider";

interface RoadmapPaneProps {
	workspaceId: string;
	onCreateNewAgentSession: CreateNewAgentSession;
	onFocusAgentTerminal: (terminalId: string) => void;
}

export function RoadmapPane({
	workspaceId,
	onCreateNewAgentSession,
	onFocusAgentTerminal,
}: RoadmapPaneProps) {
	const { t } = useLingui();
	const utils = workspaceTrpc.useUtils();
	const hostUrl = useWorkspaceHostUrl(workspaceId);
	const roadmapQuery = workspaceTrpc.roadmap.get.useQuery(
		{ workspaceId },
		{ retry: 1 },
	);
	const terminalsQuery = workspaceTrpc.terminal.list.useQuery(
		{ workspaceId },
		{ staleTime: 5_000 },
	);
	const projectId = roadmapQuery.data?.projectId;
	const roadmap = roadmapQuery.data?.roadmap;
	const apply = useRoadmapApply(workspaceId, roadmap);

	useEffect(() => {
		if (!hostUrl || !projectId) return;
		return getHostEventBus(hostUrl).on("roadmap:changed", projectId, () => {
			void utils.roadmap.get.invalidate({ workspaceId });
		});
	}, [hostUrl, projectId, utils, workspaceId]);

	const liveTerminals = useMemo(() => {
		const terminals = new Map<string, RoadmapLiveTerminal>();
		for (const session of terminalsQuery.data?.sessions ?? []) {
			if (session.exited) continue;
			terminals.set(session.terminalId, {
				terminalId: session.terminalId,
				title: session.title,
			});
		}
		return terminals;
	}, [terminalsQuery.data]);

	const context = useMemo<RoadmapContextValue | null>(
		() =>
			roadmap
				? {
						workspaceId,
						roadmap,
						apply,
						liveTerminals,
						focusTerminal: onFocusAgentTerminal,
						startWork: async ({ target, configId, instructions }) => {
							try {
								await onCreateNewAgentSession({
									configId,
									placement: "split-pane",
									prompt: buildRoadmapWorkPrompt(
										roadmap,
										[target],
										instructions,
									),
								});
							} catch (error) {
								toast.error(t({ message: "Couldn't start the agent" }), {
									description: errorMessage(error),
								});
							}
						},
					}
				: null,
		[
			apply,
			liveTerminals,
			onCreateNewAgentSession,
			onFocusAgentTerminal,
			roadmap,
			t,
			workspaceId,
		],
	);

	const copyMarkdown = async () => {
		try {
			const markdown = await utils.roadmap.exportMarkdown.fetch({
				workspaceId,
			});
			await navigator.clipboard.writeText(markdown);
			toast.success(t({ message: "Copied the Roadmap as Markdown" }));
		} catch (error) {
			toast.error(t({ message: "Couldn't copy the Roadmap" }), {
				description: errorMessage(error),
			});
		}
	};

	if (roadmapQuery.error && !roadmap)
		return (
			<RoadmapUnavailable
				error={roadmapQuery.error}
				onRetry={() => void roadmapQuery.refetch()}
			/>
		);

	if (!context)
		return (
			<div className="flex h-full items-center justify-center p-6 text-xs text-muted-foreground">
				<Trans>Loading the Roadmap…</Trans>
			</div>
		);

	return (
		<RoadmapProvider value={context}>
			<Tabs
				defaultValue="project"
				className="flex h-full min-h-0 w-full flex-col gap-0"
			>
				<div className="flex shrink-0 items-center gap-2 border-b px-2 py-1.5">
					<TabsList className="h-7">
						<TabsTrigger value="project" className="px-2 text-xs">
							<Trans>Project</Trans>
						</TabsTrigger>
						<TabsTrigger value="backlog" className="px-2 text-xs">
							<Trans>Backlog</Trans>
						</TabsTrigger>
						<TabsTrigger value="notes" className="px-2 text-xs">
							<Trans>Notes</Trans>
						</TabsTrigger>
					</TabsList>
					<div className="flex-1" />
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<Button
								size="icon-xs"
								variant="ghost"
								aria-label={t({ message: "Roadmap actions" })}
								className="size-6 text-muted-foreground"
							>
								<LuEllipsis className="size-3.5" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={() => void copyMarkdown()}>
								<LuClipboardCopy />
								<Trans>Copy as Markdown</Trans>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto p-3">
					<TabsContent value="project">
						<ProjectView />
					</TabsContent>
					<TabsContent value="backlog">
						<BacklogView />
					</TabsContent>
					<TabsContent value="notes">
						<NotesView />
					</TabsContent>
				</div>
			</Tabs>
		</RoadmapProvider>
	);
}
