import { Trans, useLingui } from "@lingui/react/macro";
import type { RoadmapWorkTarget } from "@superset/shared/roadmap";
import { Button } from "@superset/ui/button";
import { Label } from "@superset/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@superset/ui/popover";
import { Textarea } from "@superset/ui/textarea";
import { cn } from "@superset/ui/utils";
import { useState } from "react";
import { LuPlay } from "react-icons/lu";
import { AgentSelect } from "renderer/components/AgentSelect";
import { useWorkspaceHostUrl } from "renderer/hooks/host-service/useWorkspaceHostUrl";
import { useV2AgentConfigs } from "renderer/hooks/useV2AgentConfigs";
import { useRoadmap } from "../../providers/RoadmapProvider";

interface WorkOnButtonProps {
	target: RoadmapWorkTarget;
	label: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	className?: string;
}

export function WorkOnButton({
	target,
	label,
	open: controlledOpen,
	onOpenChange,
	className,
}: WorkOnButtonProps) {
	const { t } = useLingui();
	const { workspaceId, startWork } = useRoadmap();
	const hostUrl = useWorkspaceHostUrl(workspaceId);
	const { data: configs = [] } = useV2AgentConfigs(hostUrl);
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
	const [configId, setConfigId] = useState("");
	const [instructions, setInstructions] = useState("");
	const [starting, setStarting] = useState(false);
	const open = controlledOpen ?? uncontrolledOpen;
	const setOpen = onOpenChange ?? setUncontrolledOpen;
	const selectedConfigId =
		configs.find((config) => config.id === configId)?.id ?? configs[0]?.id;

	const start = async () => {
		if (!selectedConfigId || starting) return;
		setStarting(true);
		await startWork({
			target,
			configId: selectedConfigId,
			instructions: instructions.trim(),
		});
		setStarting(false);
		setInstructions("");
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					size="icon-xs"
					variant="ghost"
					aria-label={label}
					title={label}
					className={cn("size-6 text-muted-foreground", className)}
				>
					<LuPlay className="size-3" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="flex w-72 flex-col gap-2 p-3">
				<p className="text-xs font-medium">{label}</p>
				<div className="flex flex-col gap-1">
					<Label className="text-xs text-muted-foreground">
						<Trans>Agent</Trans>
					</Label>
					<AgentSelect
						agents={configs.map((config) => ({
							id: config.id,
							label: config.label,
							iconId: config.presetId,
							presetId: config.presetId,
						}))}
						value={selectedConfigId}
						placeholder={t({ message: "Select an agent" })}
						onValueChange={setConfigId}
						disabled={starting || configs.length === 0}
						triggerClassName="h-8 w-full text-xs"
						onBeforeConfigureAgents={() => setOpen(false)}
					/>
				</div>
				<Textarea
					value={instructions}
					placeholder={t({ message: "Extra instructions (optional)" })}
					aria-label={t({ message: "Extra instructions" })}
					onChange={(event) => setInstructions(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
							event.preventDefault();
							void start();
						}
					}}
					className="min-h-16 text-xs"
				/>
				<Button
					size="xs"
					disabled={!selectedConfigId || starting}
					onClick={() => void start()}
					className="self-end"
				>
					<LuPlay className="size-3" />
					<Trans>Start</Trans>
				</Button>
			</PopoverContent>
		</Popover>
	);
}
