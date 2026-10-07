import { useLingui } from "@lingui/react/macro";
import { errorMessage } from "@superset/i18n/errors";
import type { RoadmapAction, RoadmapView } from "@superset/shared/roadmap";
import { toast } from "@superset/ui/sonner";
import { workspaceTrpc } from "@superset/workspace-client";
import { TRPCClientError } from "@trpc/client";
import { useCallback } from "react";

export function useRoadmapApply(
	workspaceId: string,
	roadmap: RoadmapView | undefined,
): (actions: RoadmapAction[]) => Promise<boolean> {
	const { t } = useLingui();
	const utils = workspaceTrpc.useUtils();
	const { mutateAsync } = workspaceTrpc.roadmap.apply.useMutation();

	return useCallback(
		async (actions) => {
			if (!roadmap) return false;
			try {
				const next = await mutateAsync({
					workspaceId,
					expectedRevision: roadmap.revision,
					actions: roadmap.initialized
						? actions
						: [{ action: "init" }, ...actions],
				});
				utils.roadmap.get.setData({ workspaceId }, (previous) =>
					previous ? { ...previous, roadmap: next } : previous,
				);
				return true;
			} catch (error) {
				if (
					error instanceof TRPCClientError &&
					error.data?.code === "CONFLICT"
				) {
					void utils.roadmap.get.invalidate({ workspaceId });
					toast.info(
						t({
							message:
								"The Roadmap changed elsewhere. Showing the latest version.",
						}),
					);
					return false;
				}
				toast.error(t({ message: "Couldn't update the Roadmap" }), {
					description: errorMessage(error),
				});
				return false;
			}
		},
		[mutateAsync, roadmap, t, utils, workspaceId],
	);
}
