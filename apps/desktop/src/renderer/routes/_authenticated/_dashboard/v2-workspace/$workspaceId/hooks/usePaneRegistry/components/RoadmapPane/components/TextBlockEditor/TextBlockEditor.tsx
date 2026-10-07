import { Trans } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { Textarea } from "@superset/ui/textarea";
import { cn } from "@superset/ui/utils";
import { type KeyboardEvent, useState } from "react";

interface TextBlockEditorProps {
	initialValue: string;
	placeholder: string;
	ariaLabel: string;
	className?: string;
	onSave: (value: string) => Promise<boolean>;
	onCancel: () => void;
}

export function TextBlockEditor({
	initialValue,
	placeholder,
	ariaLabel,
	className,
	onSave,
	onCancel,
}: TextBlockEditorProps) {
	const [value, setValue] = useState(initialValue);
	const [pending, setPending] = useState(false);

	const save = async () => {
		if (pending) return;
		if (value === initialValue) {
			onCancel();
			return;
		}
		setPending(true);
		const ok = await onSave(value);
		setPending(false);
		if (ok) onCancel();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			onCancel();
		} else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			void save();
		}
	};

	return (
		<div className="flex flex-col gap-1.5">
			<Textarea
				value={value}
				placeholder={placeholder}
				aria-label={ariaLabel}
				autoFocus
				disabled={pending}
				onChange={(event) => setValue(event.target.value)}
				onKeyDown={handleKeyDown}
				className={cn("min-h-20 text-xs", className)}
			/>
			<div className="flex justify-end gap-1.5">
				<Button size="xs" variant="ghost" onClick={onCancel}>
					<Trans>Cancel</Trans>
				</Button>
				<Button size="xs" disabled={pending} onClick={() => void save()}>
					<Trans>Save</Trans>
				</Button>
			</div>
		</div>
	);
}
