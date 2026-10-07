import { Trans, useLingui } from "@lingui/react/macro";
import type {
	RoadmapBacklogItem,
	RoadmapBacklogNote,
} from "@superset/shared/roadmap";
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
	LuArrowLeftRight,
	LuArrowUp,
	LuEllipsis,
	LuListChecks,
	LuPencil,
	LuPlay,
	LuTrash2,
} from "react-icons/lu";
import { useRoadmap } from "../../../../providers/RoadmapProvider";
import {
	adjacentMove,
	backlogToPlanActions,
	type MoveDirection,
} from "../../../../utils/roadmapActions";
import { EntryEditor } from "../../../EntryEditor";
import { WorkOnButton } from "../../../WorkOnButton";

type BacklogEntryRowProps = {
	entries: RoadmapBacklogNote[];
	index: number;
} & (
	| { kind: "item"; entry: RoadmapBacklogItem }
	| { kind: "note"; entry: RoadmapBacklogNote }
);

export function BacklogEntryRow(props: BacklogEntryRowProps) {
	const { entries, index, entry } = props;
	const { t } = useLingui();
	const { apply } = useRoadmap();
	const [editing, setEditing] = useState(false);
	const [workOpen, setWorkOpen] = useState(false);
	const done = props.kind === "item" && props.entry.done;

	const move = (direction: MoveDirection) => {
		const destination = adjacentMove(entries, index, direction);
		if (!destination) return;
		void apply([
			{
				action: "backlog.move",
				number: entry.number,
				targetNumber: destination.target.number,
				position: destination.position,
			},
		]);
	};

	if (editing)
		return (
			<li>
				<EntryEditor
					initialText={entry.text}
					initialNote={entry.note}
					onSave={({ text, note }) =>
						apply([
							{ action: "backlog.edit", number: entry.number, text, note },
						])
					}
					onCancel={() => setEditing(false)}
				/>
			</li>
		);

	return (
		<li className="group flex items-start gap-2 rounded px-1 py-0.5 hover:bg-accent/40">
			{props.kind === "item" && (
				<Checkbox
					checked={props.entry.done}
					aria-label={entry.text}
					onCheckedChange={() =>
						void apply([
							{
								action: "backlog.set",
								numbers: [entry.number],
								done: !props.entry.done,
							},
						])
					}
					className="mt-0.5"
				/>
			)}
			<span className="mt-px shrink-0 font-mono text-[11px] text-muted-foreground">
				#{entry.number}
			</span>
			<div className="min-w-0 flex-1">
				<p
					className={cn(
						"whitespace-pre-wrap break-words text-xs",
						done && "text-muted-foreground line-through",
					)}
				>
					{entry.text}
				</p>
				{entry.note && (
					<p className="whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
						{entry.note}
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
					target={{ kind: "backlog", number: entry.number }}
					label={t({ message: "Work on this" })}
					open={workOpen}
					onOpenChange={setWorkOpen}
				/>
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<Button
							size="icon-xs"
							variant="ghost"
							aria-label={t({ message: "Backlog actions" })}
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
						<DropdownMenuItem
							disabled={index === 0}
							onSelect={() => move("up")}
						>
							<LuArrowUp />
							<Trans>Move up</Trans>
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={index === entries.length - 1}
							onSelect={() => move("down")}
						>
							<LuArrowDown />
							<Trans>Move down</Trans>
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() =>
								void apply([
									{
										action: "backlog.convert",
										number: entry.number,
										kind: props.kind === "item" ? "note" : "item",
									},
								])
							}
						>
							<LuArrowLeftRight />
							{props.kind === "item" ? (
								<Trans>Convert to note</Trans>
							) : (
								<Trans>Convert to task</Trans>
							)}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() => void apply(backlogToPlanActions(entry))}
						>
							<LuListChecks />
							<Trans>Convert to plan</Trans>
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => setWorkOpen(true)}>
							<LuPlay />
							<Trans>Work on this</Trans>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							onSelect={() =>
								void apply([
									{ action: "backlog.remove", numbers: [entry.number] },
								])
							}
						>
							<LuTrash2 />
							<Trans>Delete</Trans>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</li>
	);
}
