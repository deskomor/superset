import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { useState } from "react";
import { LuPencil } from "react-icons/lu";
import { MarkdownRenderer } from "renderer/components/MarkdownRenderer";
import { useRoadmap } from "../../providers/RoadmapProvider";
import { TextBlockEditor } from "../TextBlockEditor";

export function NotesView() {
	const { t } = useLingui();
	const { roadmap, apply } = useRoadmap();
	const [editing, setEditing] = useState(false);
	const notes = roadmap.overview.notes;

	if (editing)
		return (
			<TextBlockEditor
				initialValue={notes}
				placeholder={t({ message: "Project notes (Markdown)" })}
				ariaLabel={t({ message: "Project notes" })}
				className="min-h-64 font-mono"
				onSave={(text) => apply([{ action: "notes", text }])}
				onCancel={() => setEditing(false)}
			/>
		);

	return (
		<div className="flex flex-col gap-2">
			<Button
				size="xs"
				variant="outline"
				onClick={() => setEditing(true)}
				className="self-end"
			>
				<LuPencil />
				<Trans>Edit</Trans>
			</Button>
			{notes ? (
				<div className="text-sm">
					<MarkdownRenderer content={notes} />
				</div>
			) : (
				<p className="text-xs text-muted-foreground">
					<Trans>No notes yet.</Trans>
				</p>
			)}
		</div>
	);
}
