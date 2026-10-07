import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { useState } from "react";
import { LuChevronRight, LuPencil } from "react-icons/lu";
import { MarkdownRenderer } from "renderer/components/MarkdownRenderer";
import { useRoadmap } from "../../../../../../providers/RoadmapProvider";
import { TextBlockEditor } from "../../../../../TextBlockEditor";

interface PlanSummaryProps {
	planId: string;
	summary: string;
}

export function PlanSummary({ planId, summary }: PlanSummaryProps) {
	const { t } = useLingui();
	const { apply } = useRoadmap();
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState(false);

	if (editing)
		return (
			<TextBlockEditor
				initialValue={summary}
				placeholder={t({ message: "What this plan delivers (Markdown)" })}
				ariaLabel={t({ message: "Summary" })}
				onSave={(value) =>
					apply([{ action: "plan.patch", planId, summary: value }])
				}
				onCancel={() => setEditing(false)}
			/>
		);

	if (!summary)
		return (
			<Button
				size="xs"
				variant="ghost"
				onClick={() => setEditing(true)}
				className="h-6 self-start px-1 text-[11px] text-muted-foreground"
			>
				<LuPencil className="size-3" />
				<Trans>Add a summary</Trans>
			</Button>
		);

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-1">
				<button
					type="button"
					onClick={() => setOpen(!open)}
					className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
				>
					<LuChevronRight
						className={
							open ? "size-3 rotate-90 transition-transform" : "size-3"
						}
					/>
					<Trans>Summary</Trans>
				</button>
				<Button
					size="icon-xs"
					variant="ghost"
					aria-label={t({ message: "Edit summary" })}
					onClick={() => setEditing(true)}
					className="size-5 text-muted-foreground"
				>
					<LuPencil className="size-3" />
				</Button>
			</div>
			{open && (
				<div className="pl-4 text-xs">
					<MarkdownRenderer content={summary} />
				</div>
			)}
		</div>
	);
}
