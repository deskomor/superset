import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { useState } from "react";
import { LuPlus } from "react-icons/lu";
import { useRoadmap } from "../../providers/RoadmapProvider";
import { InlineInput } from "../InlineInput";
import { RoadmapProgress } from "../RoadmapProgress";
import { MilestoneCard } from "./components/MilestoneCard";
import { PlanCard } from "./components/PlanCard";
import { VisionSection } from "./components/VisionSection";

export function ProjectView() {
	const { t } = useLingui();
	const { roadmap, apply } = useRoadmap();
	const [adding, setAdding] = useState<"milestone" | "plan" | null>(null);
	const milestoneIds = new Set(
		roadmap.overview.milestones.map((milestone) => milestone.id),
	);
	const otherPlans = roadmap.plans.filter(
		(plan) => !plan.milestone || !milestoneIds.has(plan.milestone),
	);

	return (
		<div className="flex flex-col gap-4">
			<RoadmapProgress progress={roadmap.progress} />
			<VisionSection />
			{roadmap.overview.milestones.length > 0 && (
				<section className="flex flex-col gap-2">
					<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
						<Trans>Milestones</Trans>
					</h3>
					{roadmap.overview.milestones.map((milestone, index) => (
						<MilestoneCard
							key={milestone.id}
							milestone={milestone}
							index={index}
							plans={roadmap.plans.filter(
								(plan) => plan.milestone === milestone.id,
							)}
						/>
					))}
				</section>
			)}
			{otherPlans.length > 0 && (
				<section className="flex flex-col gap-1.5">
					<h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
						{roadmap.overview.milestones.length > 0 ? (
							<Trans>Other plans</Trans>
						) : (
							<Trans context="roadmap">Plans</Trans>
						)}
					</h3>
					{otherPlans.map((plan) => (
						<PlanCard key={plan.id} plan={plan} />
					))}
				</section>
			)}
			{adding ? (
				<InlineInput
					key={adding}
					autoFocus
					placeholder={
						adding === "milestone"
							? t({ message: "New milestone title" })
							: t({ message: "New plan title" })
					}
					onSubmit={async (title) => {
						const ok = await apply([
							adding === "milestone"
								? { action: "milestone.create", title }
								: { action: "plan.create", title },
						]);
						if (ok) setAdding(null);
						return ok;
					}}
					onCancel={() => setAdding(null)}
				/>
			) : (
				<div className="flex gap-1.5">
					<Button
						size="xs"
						variant="outline"
						onClick={() => setAdding("milestone")}
					>
						<LuPlus />
						<Trans>Add milestone</Trans>
					</Button>
					<Button size="xs" variant="outline" onClick={() => setAdding("plan")}>
						<LuPlus />
						<Trans>Add plan</Trans>
					</Button>
				</div>
			)}
		</div>
	);
}
