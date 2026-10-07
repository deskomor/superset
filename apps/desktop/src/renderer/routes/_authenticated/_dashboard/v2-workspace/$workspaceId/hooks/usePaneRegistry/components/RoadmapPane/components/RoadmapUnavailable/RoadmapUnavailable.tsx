import { Trans } from "@lingui/react/macro";
import { errorMessage } from "@superset/i18n/errors";
import { Button } from "@superset/ui/button";
import { TRPCClientError } from "@trpc/client";
import { LuMap } from "react-icons/lu";

interface RoadmapUnavailableProps {
	error: unknown;
	onRetry: () => void;
}

export function RoadmapUnavailable({
	error,
	onRetry,
}: RoadmapUnavailableProps) {
	const hostTooOld =
		error instanceof TRPCClientError &&
		error.data?.code === "NOT_FOUND" &&
		/no procedure/i.test(error.message);

	return (
		<div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
			<LuMap className="size-6 text-muted-foreground" />
			<p className="text-sm font-medium">
				<Trans>The Roadmap is not available here</Trans>
			</p>
			<p className="max-w-72 text-xs text-muted-foreground">
				{hostTooOld ? (
					<Trans>
						This workspace's host runs an older version without the Roadmap.
						Update it to plan this project here.
					</Trans>
				) : (
					errorMessage(error)
				)}
			</p>
			{!hostTooOld && (
				<Button size="xs" variant="outline" onClick={onRetry}>
					<Trans>Try again</Trans>
				</Button>
			)}
		</div>
	);
}
