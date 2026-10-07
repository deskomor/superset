import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { LuSquareTerminal } from "react-icons/lu";
import { useRoadmap } from "../../../../../../providers/RoadmapProvider";

interface ConversationsSectionProps {
	sessions: string[];
}

export function ConversationsSection({ sessions }: ConversationsSectionProps) {
	const { t } = useLingui();
	const { liveTerminals, focusTerminal } = useRoadmap();
	if (sessions.length === 0) return null;

	return (
		<div className="flex flex-col gap-1">
			<span className="text-[11px] font-medium text-muted-foreground">
				<Trans>Conversations</Trans>
			</span>
			<ul className="flex flex-wrap gap-1">
				{sessions.map((sessionId) => {
					const terminal = liveTerminals.get(sessionId);
					return (
						<li key={sessionId}>
							{terminal ? (
								<Button
									size="xs"
									variant="outline"
									title={t({ message: "Open this conversation" })}
									onClick={() => focusTerminal(sessionId)}
									className="h-6 max-w-48 text-[11px]"
								>
									<LuSquareTerminal className="size-3" />
									<span className="truncate">
										{terminal.title || sessionId.slice(0, 8)}
									</span>
								</Button>
							) : (
								<span
									className="inline-flex h-6 items-center rounded-md border border-dashed px-2 font-mono text-[11px] text-muted-foreground"
									title={t({ message: "This conversation is not open here" })}
								>
									{sessionId.slice(0, 8)}
								</span>
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
}
