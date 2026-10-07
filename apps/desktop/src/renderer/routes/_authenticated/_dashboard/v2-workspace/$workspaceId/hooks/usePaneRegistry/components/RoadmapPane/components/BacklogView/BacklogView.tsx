import { Trans, useLingui } from "@lingui/react/macro";
import { useRoadmap } from "../../providers/RoadmapProvider";
import { InlineInput } from "../InlineInput";
import { BacklogEntryRow } from "./components/BacklogEntryRow";

export function BacklogView() {
	const { t } = useLingui();
	const { roadmap, apply } = useRoadmap();
	const { items, notes } = roadmap.backlog;

	return (
		<div className="flex flex-col gap-4">
			<p className="text-[11px] text-muted-foreground">
				<Trans>The backlog does not count toward plan progress.</Trans>
			</p>
			<section className="flex flex-col gap-1">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					<Trans>Tasks</Trans>
				</h3>
				{items.length > 0 && (
					<ul className="flex flex-col">
						{items.map((entry, index) => (
							<BacklogEntryRow
								key={entry.number}
								kind="item"
								entry={entry}
								entries={items}
								index={index}
							/>
						))}
					</ul>
				)}
				<InlineInput
					placeholder={t({ message: "Add a task" })}
					onSubmit={(text) =>
						apply([{ action: "backlog.add", items: [{ text }] }])
					}
				/>
			</section>
			<section className="flex flex-col gap-1">
				<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					<Trans>Notes</Trans>
				</h3>
				{notes.length > 0 && (
					<ul className="flex flex-col">
						{notes.map((entry, index) => (
							<BacklogEntryRow
								key={entry.number}
								kind="note"
								entry={entry}
								entries={notes}
								index={index}
							/>
						))}
					</ul>
				)}
				<InlineInput
					placeholder={t({ message: "Add a note" })}
					onSubmit={(text) =>
						apply([{ action: "backlog.add", notes: [{ text }] }])
					}
				/>
			</section>
		</div>
	);
}
