import { Trans, useLingui } from "@lingui/react/macro";
import type {
	RoadmapPlanStatus,
	RoadmapViewPlan,
} from "@superset/shared/roadmap";
import { Button } from "@superset/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@superset/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { cn } from "@superset/ui/utils";
import { useState } from "react";
import { LuChevronRight, LuEllipsis, LuPencil, LuTrash2 } from "react-icons/lu";
import { useRoadmap } from "../../../../providers/RoadmapProvider";
import { InlineInput } from "../../../InlineInput";
import { RoadmapProgress } from "../../../RoadmapProgress";
import { WorkOnButton } from "../../../WorkOnButton";
import { CompactSelect } from "../CompactSelect";
import { ConversationsSection } from "./components/ConversationsSection";
import { JournalSection } from "./components/JournalSection";
import { PlanSummary } from "./components/PlanSummary";
import { StepItem } from "./components/StepItem";

const NO_MILESTONE = "__none__";

interface PlanCardProps {
	plan: RoadmapViewPlan;
}

export function PlanCard({ plan }: PlanCardProps) {
	const { t } = useLingui();
	const { roadmap, apply } = useRoadmap();
	const [open, setOpen] = useState(plan.status === "active");
	const [renaming, setRenaming] = useState(false);
	const statusOptions: { value: RoadmapPlanStatus; label: string }[] = [
		{
			value: "active",
			label: t({ message: "Active", context: "roadmap status" }),
		},
		{
			value: "paused",
			label: t({ message: "Paused", context: "roadmap status" }),
		},
		{ value: "done", label: t({ message: "Done", context: "roadmap status" }) },
		{
			value: "abandoned",
			label: t({ message: "Abandoned", context: "roadmap status" }),
		},
	];
	const milestoneOptions = [
		{ value: NO_MILESTONE, label: t({ message: "No milestone" }) },
		...roadmap.overview.milestones.map((milestone) => ({
			value: milestone.id,
			label: milestone.title,
		})),
	];

	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			className="rounded-md border bg-card/40"
		>
			<div className="flex items-center gap-1 px-1.5 py-1">
				<CollapsibleTrigger asChild>
					<Button
						size="icon-xs"
						variant="ghost"
						aria-label={
							open
								? t({ message: "Collapse plan" })
								: t({ message: "Expand plan" })
						}
						className="size-6 shrink-0 text-muted-foreground"
					>
						<LuChevronRight
							className={cn(
								"size-3.5 transition-transform",
								open && "rotate-90",
							)}
						/>
					</Button>
				</CollapsibleTrigger>
				{renaming ? (
					<InlineInput
						autoFocus
						initialValue={plan.title}
						placeholder={t({ message: "Plan title" })}
						onSubmit={async (title) => {
							const ok = await apply([
								{ action: "plan.patch", planId: plan.id, title },
							]);
							if (ok) setRenaming(false);
							return ok;
						}}
						onCancel={() => setRenaming(false)}
					/>
				) : (
					<button
						type="button"
						onClick={() => setRenaming(true)}
						title={t({ message: "Rename plan" })}
						className={cn(
							"min-w-0 flex-1 truncate text-left text-xs font-medium",
							(plan.status === "done" || plan.status === "abandoned") &&
								"text-muted-foreground",
						)}
					>
						{plan.title}
					</button>
				)}
				<RoadmapProgress progress={plan.progress} className="w-20 shrink-0" />
				<CompactSelect
					value={plan.status}
					options={statusOptions}
					ariaLabel={t({ message: "Plan status" })}
					onValueChange={(status) =>
						void apply([{ action: "plan.patch", planId: plan.id, status }])
					}
				/>
				<WorkOnButton
					target={{ kind: "plan", planId: plan.id }}
					label={t({ message: "Work on plan" })}
				/>
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<Button
							size="icon-xs"
							variant="ghost"
							aria-label={t({ message: "Plan actions" })}
							className="size-6 text-muted-foreground"
						>
							<LuEllipsis className="size-3.5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						onCloseAutoFocus={(event) => event.preventDefault()}
					>
						<DropdownMenuItem onSelect={() => setRenaming(true)}>
							<LuPencil />
							<Trans>Rename</Trans>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							onSelect={() =>
								void apply([{ action: "plan.delete", planId: plan.id }])
							}
						>
							<LuTrash2 />
							<Trans>Delete plan</Trans>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<CollapsibleContent className="flex flex-col gap-2 border-t px-3 py-2">
				<div className="flex items-center gap-2">
					<span className="text-[11px] text-muted-foreground">
						<Trans>Milestone</Trans>
					</span>
					<CompactSelect
						value={plan.milestone ?? NO_MILESTONE}
						options={milestoneOptions}
						ariaLabel={t({ message: "Milestone" })}
						className="max-w-48"
						onValueChange={(value) =>
							void apply([
								{
									action: "plan.patch",
									planId: plan.id,
									milestone: value === NO_MILESTONE ? null : value,
								},
							])
						}
					/>
				</div>
				<PlanSummary planId={plan.id} summary={plan.summary} />
				{plan.steps.length > 0 && (
					<ul className="flex flex-col">
						{plan.steps.map((step, index) => (
							<StepItem
								key={step.id}
								planId={plan.id}
								step={step}
								depth={1}
								index={index}
								siblingCount={plan.steps.length}
							/>
						))}
					</ul>
				)}
				<InlineInput
					placeholder={t({ message: "Add a task" })}
					onSubmit={(text) =>
						apply([{ action: "step.add", planId: plan.id, text }])
					}
				/>
				<JournalSection planId={plan.id} journal={plan.journal} />
				<ConversationsSection sessions={plan.sessions} />
			</CollapsibleContent>
		</Collapsible>
	);
}
