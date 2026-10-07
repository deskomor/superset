import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { cn } from "@superset/ui/utils";

interface CompactSelectProps<T extends string> {
	value: T;
	options: { value: T; label: string }[];
	ariaLabel: string;
	className?: string;
	onValueChange: (value: T) => void;
}

export function CompactSelect<T extends string>({
	value,
	options,
	ariaLabel,
	className,
	onValueChange,
}: CompactSelectProps<T>) {
	return (
		<Select
			value={value}
			onValueChange={(next) => {
				if (next !== value) onValueChange(next as T);
			}}
		>
			<SelectTrigger
				size="sm"
				aria-label={ariaLabel}
				className={cn(
					"gap-1 px-1.5 py-0 text-[11px] data-[size=sm]:h-6",
					className,
				)}
			>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem
						key={option.value}
						value={option.value}
						className="text-xs"
					>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
