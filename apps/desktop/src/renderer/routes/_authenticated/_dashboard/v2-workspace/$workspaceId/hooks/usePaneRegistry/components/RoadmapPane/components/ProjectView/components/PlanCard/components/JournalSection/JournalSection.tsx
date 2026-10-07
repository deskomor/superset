import { Trans, useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import type { RoadmapJournalEntry } from "@superset/shared/roadmap";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@superset/ui/collapsible";
import { useState } from "react";
import { LuChevronRight } from "react-icons/lu";
import { useRoadmap } from "../../../../../../providers/RoadmapProvider";
import { InlineInput } from "../../../../../InlineInput";

interface JournalSectionProps {
	planId: string;
	journal: RoadmapJournalEntry[];
}

export function JournalSection({ planId, journal }: JournalSectionProps) {
	const { t } = useLingui();
	const { formatNumber, formatDateTime, formatRelativeTime } = useFormat();
	const { apply } = useRoadmap();
	const [open, setOpen] = useState(false);
	const count = formatNumber(journal.length);

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
				<LuChevronRight
					className={open ? "size-3 rotate-90 transition-transform" : "size-3"}
				/>
				<Trans>Journal ({count})</Trans>
			</CollapsibleTrigger>
			<CollapsibleContent className="flex flex-col gap-1.5 pt-1.5 pl-4">
				<InlineInput
					placeholder={t({ message: "Add a journal entry" })}
					onSubmit={(text) => apply([{ action: "journal.add", planId, text }])}
				/>
				<ul className="flex flex-col gap-1.5">
					{[...journal].reverse().map((entry) => (
						<li key={entry.id} className="flex flex-col">
							<span
								className="text-[10px] text-muted-foreground"
								title={formatDateTime(entry.at)}
							>
								{formatRelativeTime(entry.at)} ·{" "}
								{entry.name ||
									(entry.by === "agent"
										? t({ message: "Agent" })
										: t({ message: "You" }))}
							</span>
							<p className="whitespace-pre-wrap break-words text-xs">
								{entry.text}
							</p>
						</li>
					))}
				</ul>
			</CollapsibleContent>
		</Collapsible>
	);
}
