import { Trans, useLingui } from "@lingui/react/macro";
import type { RoadmapViewStep } from "@superset/shared/roadmap";
import { Button } from "@superset/ui/button";
import { Checkbox } from "@superset/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { cn } from "@superset/ui/utils";
import { useState } from "react";
import {
	LuArrowDown,
	LuArrowUp,
	LuEllipsis,
	LuPencil,
	LuPlay,
	LuPlus,
	LuTrash2,
} from "react-icons/lu";
import { useRoadmap } from "../../../../../../providers/RoadmapProvider";
import { EntryEditor } from "../../../../../EntryEditor";
import { InlineInput } from "../../../../../InlineInput";
import { WorkOnButton } from "../../../../../WorkOnButton";

const MAX_DEPTH = 3;

interface StepItemProps {
	planId: string;
	step: RoadmapViewStep;
	depth: number;
	index: number;
	siblingCount: number;
}

export function StepItem({
	planId,
	step,
	depth,
	index,
	siblingCount,
}: StepItemProps) {
	const { t } = useLingui();
	const { apply } = useRoadmap();
	const [editing, setEditing] = useState(false);
	const [addingChild, setAddingChild] = useState(false);
	const [workOpen, setWorkOpen] = useState(false);
	const children: RoadmapViewStep[] = step.children;

	return (
		<li className="flex flex-col">
			{editing ? (
				<EntryEditor
					initialText={step.text}
					initialNote={step.note}
					onSave={({ text, note }) =>
						apply([
							{ action: "step.edit", planId, stepId: step.id, text, note },
						])
					}
					onCancel={() => setEditing(false)}
				/>
			) : (
				<div className="group flex items-start gap-2 rounded px-1 py-0.5 hover:bg-accent/40">
					<Checkbox
						checked={step.done ? true : step.partial ? "indeterminate" : false}
						aria-label={step.text}
						onCheckedChange={() =>
							void apply([
								{
									action: "step.check",
									planId,
									stepId: step.id,
									done: !step.done,
								},
							])
						}
						className="mt-0.5 data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary/30"
					/>
					<div className="min-w-0 flex-1">
						<p
							className={cn(
								"whitespace-pre-wrap break-words text-xs",
								step.done && "text-muted-foreground line-through",
							)}
						>
							{step.text}
						</p>
						{step.note && (
							<p className="whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
								{step.note}
							</p>
						)}
					</div>
					<div
						className={cn(
							"flex shrink-0 items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100",
							workOpen && "opacity-100",
						)}
					>
						<WorkOnButton
							target={{ kind: "plan", planId, stepId: step.id }}
							label={t({ message: "Work on task" })}
							open={workOpen}
							onOpenChange={setWorkOpen}
						/>
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger asChild>
								<Button
									size="icon-xs"
									variant="ghost"
									aria-label={t({ message: "Task actions" })}
									className="size-6 text-muted-foreground"
								>
									<LuEllipsis className="size-3.5" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								onCloseAutoFocus={(event) => event.preventDefault()}
							>
								<DropdownMenuItem onSelect={() => setEditing(true)}>
									<LuPencil />
									<Trans>Edit</Trans>
								</DropdownMenuItem>
								{depth < MAX_DEPTH && (
									<DropdownMenuItem onSelect={() => setAddingChild(true)}>
										<LuPlus />
										<Trans>Add subtask</Trans>
									</DropdownMenuItem>
								)}
								<DropdownMenuItem
									disabled={index === 0}
									onSelect={() =>
										void apply([
											{
												action: "step.move",
												planId,
												stepId: step.id,
												direction: "up",
											},
										])
									}
								>
									<LuArrowUp />
									<Trans>Move up</Trans>
								</DropdownMenuItem>
								<DropdownMenuItem
									disabled={index === siblingCount - 1}
									onSelect={() =>
										void apply([
											{
												action: "step.move",
												planId,
												stepId: step.id,
												direction: "down",
											},
										])
									}
								>
									<LuArrowDown />
									<Trans>Move down</Trans>
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setWorkOpen(true)}>
									<LuPlay />
									<Trans>Work on task</Trans>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									variant="destructive"
									onSelect={() =>
										void apply([
											{ action: "step.remove", planId, stepId: step.id },
										])
									}
								>
									<LuTrash2 />
									<Trans>Delete</Trans>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			)}
			{(children.length > 0 || addingChild) && (
				<ul className="ml-5 flex flex-col">
					{children.map((child, childIndex) => (
						<StepItem
							key={child.id}
							planId={planId}
							step={child}
							depth={depth + 1}
							index={childIndex}
							siblingCount={children.length}
						/>
					))}
					{addingChild && (
						<li className="py-0.5 pl-1">
							<InlineInput
								autoFocus
								placeholder={t({ message: "Add a subtask" })}
								onSubmit={(text) =>
									apply([
										{ action: "step.add", planId, text, parentId: step.id },
									])
								}
								onCancel={() => setAddingChild(false)}
							/>
						</li>
					)}
				</ul>
			)}
		</li>
	);
}
