import { useLingui } from "@lingui/react/macro";
import { type RefObject, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

export type SelectionAction =
	| "add"
	| "ask"
	| "details"
	| "task"
	| "plan"
	| "fork";

const GAP = 8;
const EDGE = 8;

interface SelectionActionsToolbarProps {
	ref: RefObject<HTMLDivElement | null>;
	rect: DOMRect;
	actions: SelectionAction[];
	onAction: (action: SelectionAction) => void;
}

export function SelectionActionsToolbar({
	ref,
	rect,
	actions,
	onAction,
}: SelectionActionsToolbarProps) {
	const { t } = useLingui();
	const labels: Record<SelectionAction, string> = {
		add: t({ message: "Add to chat" }),
		ask: t({ message: "Ask in side chat" }),
		details: t({ message: "More details" }),
		task: t({ message: "Create a task" }),
		plan: t({ message: "Create a plan" }),
		fork: t({ message: "Fork from here" }),
	};

	useLayoutEffect(() => {
		const toolbar = ref.current;
		if (!toolbar) return;
		const box = toolbar.getBoundingClientRect();
		const left = Math.max(
			EDGE,
			Math.min(
				window.innerWidth - box.width - EDGE,
				rect.left + rect.width / 2 - box.width / 2,
			),
		);
		const above = rect.top - box.height - GAP;
		const top =
			above < EDGE
				? Math.min(rect.bottom + GAP, window.innerHeight - box.height - EDGE)
				: above;
		toolbar.style.left = `${Math.round(left)}px`;
		toolbar.style.top = `${Math.round(top)}px`;
		toolbar.style.visibility = "visible";
	}, [ref, rect]);

	return createPortal(
		<div
			ref={ref}
			role="toolbar"
			aria-label={t({ message: "Selected text actions" })}
			className="fade-in-0 zoom-in-95 flex animate-in items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 shadow-lg duration-100"
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				zIndex: 100000,
				visibility: "hidden",
			}}
			// Keeps the selection and the pane focus while a button is pressed.
			onMouseDown={(event) => event.preventDefault()}
		>
			{actions.map((action) => (
				<button
					key={action}
					className="whitespace-nowrap rounded-md px-2 py-1 text-popover-foreground text-xs transition-colors duration-100 hover:bg-accent focus-visible:bg-accent active:scale-[0.97]"
					onClick={() => onAction(action)}
					type="button"
				>
					{labels[action]}
				</button>
			))}
		</div>,
		document.body,
	);
}
