import { useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import type { RoadmapProgress as Progress } from "@superset/shared/roadmap";
import { Progress as ProgressBar } from "@superset/ui/progress";
import { cn } from "@superset/ui/utils";

interface RoadmapProgressProps {
	progress: Progress;
	className?: string;
}

export function RoadmapProgress({ progress, className }: RoadmapProgressProps) {
	const { t } = useLingui();
	const { formatNumber } = useFormat();
	const done = formatNumber(progress.done);
	const total = formatNumber(progress.total);
	return (
		<div className={cn("flex min-w-0 items-center gap-2", className)}>
			<ProgressBar
				value={progress.percent}
				aria-label={t({ message: `${done} of ${total} tasks checked` })}
				className="h-1.5 flex-1"
			/>
			<span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
				{done}/{total}
			</span>
		</div>
	);
}
