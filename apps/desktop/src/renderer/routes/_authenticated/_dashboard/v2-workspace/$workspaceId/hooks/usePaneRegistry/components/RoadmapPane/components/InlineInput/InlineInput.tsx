import { Input } from "@superset/ui/input";
import { cn } from "@superset/ui/utils";
import { type KeyboardEvent, useState } from "react";

interface InlineInputProps {
	placeholder: string;
	ariaLabel?: string;
	initialValue?: string;
	autoFocus?: boolean;
	className?: string;
	onSubmit: (value: string) => Promise<boolean>;
	onCancel?: () => void;
}

export function InlineInput({
	placeholder,
	ariaLabel,
	initialValue = "",
	autoFocus,
	className,
	onSubmit,
	onCancel,
}: InlineInputProps) {
	const [value, setValue] = useState(initialValue);
	const [pending, setPending] = useState(false);

	const submit = async () => {
		const trimmed = value.trim();
		if (!trimmed || pending) return;
		if (trimmed === initialValue.trim()) {
			onCancel?.();
			return;
		}
		setPending(true);
		const ok = await onSubmit(trimmed);
		setPending(false);
		if (ok && !initialValue) setValue("");
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter" && !event.nativeEvent.isComposing) {
			event.preventDefault();
			void submit();
		} else if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			setValue(initialValue);
			onCancel?.();
		}
	};

	return (
		<Input
			value={value}
			placeholder={placeholder}
			aria-label={ariaLabel ?? placeholder}
			autoFocus={autoFocus}
			disabled={pending}
			onChange={(event) => setValue(event.target.value)}
			onKeyDown={handleKeyDown}
			onBlur={() => {
				if (onCancel && value.trim() === initialValue.trim()) onCancel();
			}}
			className={cn("h-7 text-xs", className)}
		/>
	);
}
