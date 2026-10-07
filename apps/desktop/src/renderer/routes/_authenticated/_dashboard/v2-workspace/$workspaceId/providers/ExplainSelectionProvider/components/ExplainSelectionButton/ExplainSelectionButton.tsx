import { Trans } from "@lingui/react/macro";
import type { Ref } from "react";
import { createPortal } from "react-dom";
import { LuSparkles } from "react-icons/lu";

const BUTTON_HEIGHT = 26;
const BUTTON_WIDTH = 84;
const GAP = 6;

interface ExplainSelectionButtonProps {
	ref: Ref<HTMLDivElement>;
	rect: DOMRect;
	onExplain: () => void;
}

export function ExplainSelectionButton({
	ref,
	rect,
	onExplain,
}: ExplainSelectionButtonProps) {
	const left = Math.max(
		8,
		Math.min(
			rect.left + rect.width / 2 - BUTTON_WIDTH / 2,
			window.innerWidth - BUTTON_WIDTH - 8,
		),
	);
	const showAbove = rect.top > BUTTON_HEIGHT + GAP * 2;
	const top = showAbove
		? rect.top - BUTTON_HEIGHT - GAP
		: Math.min(rect.bottom + GAP, window.innerHeight - BUTTON_HEIGHT - 8);

	return createPortal(
		<div
			ref={ref}
			className="fade-in-0 zoom-in-95 animate-in duration-100"
			style={{ position: "fixed", top, left, zIndex: 100000 }}
		>
			<button
				className="flex items-center gap-1 rounded-md border border-border bg-popover px-2 py-1 text-popover-foreground text-xs shadow-lg transition-colors duration-100 hover:bg-accent active:scale-[0.97]"
				// Keeps the selection and the pane focus while the click lands.
				onMouseDown={(event) => event.preventDefault()}
				onClick={onExplain}
				type="button"
			>
				<LuSparkles className="size-3" />
				<Trans>Explain</Trans>
			</button>
		</div>,
		document.body,
	);
}
