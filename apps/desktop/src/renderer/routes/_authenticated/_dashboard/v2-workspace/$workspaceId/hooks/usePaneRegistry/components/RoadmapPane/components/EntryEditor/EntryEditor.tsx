import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { Input } from "@superset/ui/input";
import { Textarea } from "@superset/ui/textarea";
import { type KeyboardEvent, useState } from "react";

interface EntryEditorProps {
	initialText: string;
	initialNote: string;
	onSave: (value: { text: string; note: string }) => Promise<boolean>;
	onCancel: () => void;
}

export function EntryEditor({
	initialText,
	initialNote,
	onSave,
	onCancel,
}: EntryEditorProps) {
	const { t } = useLingui();
	const [text, setText] = useState(initialText);
	const [note, setNote] = useState(initialNote);
	const [pending, setPending] = useState(false);

	const save = async () => {
		if (pending || !text.trim()) return;
		if (text === initialText && note === initialNote) {
			onCancel();
			return;
		}
		setPending(true);
		const ok = await onSave({ text: text.trim(), note: note.trim() });
		setPending(false);
		if (ok) onCancel();
	};

	const handleKeyDown = (
		event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			onCancel();
			return;
		}
		const isInput = event.currentTarget instanceof HTMLInputElement;
		if (
			event.key === "Enter" &&
			!event.nativeEvent.isComposing &&
			(isInput || event.metaKey || event.ctrlKey)
		) {
			event.preventDefault();
			void save();
		}
	};

	return (
		<div className="flex flex-col gap-1.5 py-1">
			<Input
				value={text}
				autoFocus
				disabled={pending}
				aria-label={t({ message: "Text" })}
				onChange={(event) => setText(event.target.value)}
				onKeyDown={handleKeyDown}
				className="h-7 text-xs"
			/>
			<Textarea
				value={note}
				disabled={pending}
				placeholder={t({ message: "Note (optional)" })}
				aria-label={t({ message: "Note" })}
				onChange={(event) => setNote(event.target.value)}
				onKeyDown={handleKeyDown}
				className="min-h-12 text-xs"
			/>
			<div className="flex justify-end gap-1.5">
				<Button size="xs" variant="ghost" onClick={onCancel}>
					<Trans>Cancel</Trans>
				</Button>
				<Button
					size="xs"
					disabled={pending || !text.trim()}
					onClick={() => void save()}
				>
					<Trans>Save</Trans>
				</Button>
			</div>
		</div>
	);
}
