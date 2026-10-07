import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { useRoadmap } from "../../../../providers/RoadmapProvider";
import { TextBlockEditor } from "../../../TextBlockEditor";

export function VisionSection() {
	const { t } = useLingui();
	const { roadmap, apply } = useRoadmap();
	const [editing, setEditing] = useState(false);
	const vision = roadmap.overview.vision;

	return (
		<section className="flex flex-col gap-1">
			<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
				<Trans>Vision</Trans>
			</h3>
			{editing ? (
				<TextBlockEditor
					initialValue={vision}
					placeholder={t({ message: "Where is this project going?" })}
					ariaLabel={t({ message: "Vision" })}
					onSave={(text) => apply([{ action: "vision", text }])}
					onCancel={() => setEditing(false)}
				/>
			) : (
				<button
					type="button"
					onClick={() => setEditing(true)}
					title={t({ message: "Edit vision" })}
					className="whitespace-pre-wrap break-words rounded px-1 py-0.5 text-left text-xs hover:bg-accent/40"
				>
					{vision || (
						<span className="text-muted-foreground">
							<Trans>Describe where this project is going.</Trans>
						</span>
					)}
				</button>
			)}
		</section>
	);
}
