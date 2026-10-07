import { Trans, useLingui } from "@lingui/react/macro";
import type {
	RoadmapMilestoneStatus,
	RoadmapView,
	RoadmapViewPlan,
} from "@superset/shared/roadmap";
import { Button } from "@superset/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { useState } from "react";
import {
	LuArrowDown,
	LuArrowUp,
	LuEllipsis,
	LuFileText,
	LuPencil,
	LuPlus,
	LuTrash2,
} from "react-icons/lu";
import { useRoadmap } from "../../../../providers/RoadmapProvider";
import { adjacentMove } from "../../../../utils/roadmapActions";
import { InlineInput } from "../../../InlineInput";
import { RoadmapProgress } from "../../../RoadmapProgress";
import { TextBlockEditor } from "../../../TextBlockEditor";
import { WorkOnButton } from "../../../WorkOnButton";
import { CompactSelect } from "../CompactSelect";
import { PlanCard } from "../PlanCard";

interface MilestoneCardProps {
	milestone: RoadmapView["overview"]["milestones"][number];
	index: number;
	plans: RoadmapViewPlan[];
}

export function MilestoneCard({ milestone, index, plans }: MilestoneCardProps) {
	const { t } = useLingui();
	const { roadmap, apply } = useRoadmap();
	const [renaming, setRenaming] = useState(false);
	const [editingSummary, setEditingSummary] = useState(false);
	const [addingPlan, setAddingPlan] = useState(false);
	const milestones = roadmap.overview.milestones;
	const statusOptions: { value: RoadmapMilestoneStatus; label: string }[] = [
		{
			value: "planned",
			label: t({ message: "Planned", context: "roadmap status" }),
		},
		{
			value: "active",
			label: t({ message: "Active", context: "roadmap status" }),
		},
		{ value: "done", label: t({ message: "Done", context: "roadmap status" }) },
	];

	const move = (direction: "up" | "down") => {
		const destination = adjacentMove(milestones, index, direction);
		if (!destination) return;
		void apply([
			{
				action: "milestone.move",
				milestoneId: milestone.id,
				targetId: destination.target.id,
				position: destination.position,
			},
		]);
	};

	return (
		<section className="flex flex-col gap-1.5 rounded-md border p-2">
			<div className="flex items-center gap-1">
				{renaming ? (
					<InlineInput
						autoFocus
						initialValue={milestone.title}
						placeholder={t({ message: "Milestone title" })}
						onSubmit={async (title) => {
							const ok = await apply([
								{ action: "milestone.patch", milestoneId: milestone.id, title },
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
						title={t({ message: "Rename milestone" })}
						className="min-w-0 flex-1 truncate text-left text-sm font-semibold"
					>
						{milestone.title}
					</button>
				)}
				<CompactSelect
					value={milestone.status}
					options={statusOptions}
					ariaLabel={t({ message: "Milestone status" })}
					onValueChange={(status) =>
						void apply([
							{ action: "milestone.patch", milestoneId: milestone.id, status },
						])
					}
				/>
				<WorkOnButton
					target={{ kind: "milestone", milestoneId: milestone.id }}
					label={t({ message: "Work on milestone" })}
				/>
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<Button
							size="icon-xs"
							variant="ghost"
							aria-label={t({ message: "Milestone actions" })}
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
						<DropdownMenuItem onSelect={() => setEditingSummary(true)}>
							<LuFileText />
							<Trans>Edit summary</Trans>
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setAddingPlan(true)}>
							<LuPlus />
							<Trans>Add plan</Trans>
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={index === 0}
							onSelect={() => move("up")}
						>
							<LuArrowUp />
							<Trans>Move up</Trans>
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={index === milestones.length - 1}
							onSelect={() => move("down")}
						>
							<LuArrowDown />
							<Trans>Move down</Trans>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							onSelect={() =>
								void apply([
									{ action: "milestone.delete", milestoneId: milestone.id },
								])
							}
						>
							<LuTrash2 />
							<Trans>Delete milestone</Trans>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<RoadmapProgress progress={milestone.progress} />
			{editingSummary ? (
				<TextBlockEditor
					initialValue={milestone.summary}
					placeholder={t({ message: "What this milestone means" })}
					ariaLabel={t({ message: "Milestone summary" })}
					onSave={(summary) =>
						apply([
							{ action: "milestone.patch", milestoneId: milestone.id, summary },
						])
					}
					onCancel={() => setEditingSummary(false)}
				/>
			) : (
				milestone.summary && (
					<button
						type="button"
						onClick={() => setEditingSummary(true)}
						className="whitespace-pre-wrap break-words text-left text-xs text-muted-foreground"
					>
						{milestone.summary}
					</button>
				)
			)}
			{plans.length > 0 && (
				<div className="flex flex-col gap-1.5">
					{plans.map((plan) => (
						<PlanCard key={plan.id} plan={plan} />
					))}
				</div>
			)}
			{addingPlan && (
				<InlineInput
					autoFocus
					placeholder={t({ message: "New plan title" })}
					onSubmit={async (title) => {
						const ok = await apply([
							{ action: "plan.create", title, milestone: milestone.id },
						]);
						if (ok) setAddingPlan(false);
						return ok;
					}}
					onCancel={() => setAddingPlan(false)}
				/>
			)}
		</section>
	);
}
