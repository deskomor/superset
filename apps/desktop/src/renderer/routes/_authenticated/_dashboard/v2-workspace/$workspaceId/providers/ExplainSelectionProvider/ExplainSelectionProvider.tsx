import { useLingui } from "@lingui/react/macro";
import { buildExplainSelectionPrompt } from "@superset/shared/terminal-session-handoff";
import { toast } from "@superset/ui/sonner";
import { useWorkspaceClient } from "@superset/workspace-client";
import { useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	type RefObject,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { v2AgentConfigsQueryOptions } from "renderer/hooks/useV2AgentConfigs";
import type { CreateNewAgentSession } from "../../hooks/useAgentSessionLauncher";
import { ExplainSelectionButton } from "./components/ExplainSelectionButton";

export interface ExplainSelectionContext {
	kind: "chat" | "terminal";
	transcript: string;
	sourceLabel?: string;
	presetId?: string;
}

export interface ExplainSelectionSource {
	/** For surfaces that keep their selection outside the DOM, such as xterm. */
	readSelection?: () => string;
	readContext: () => Promise<ExplainSelectionContext | null>;
}

type SourceRef = RefObject<ExplainSelectionSource>;

interface Registry {
	register: (element: HTMLElement, source: SourceRef) => () => void;
}

interface Anchor {
	text: string;
	source: ExplainSelectionSource | null;
	rect: DOMRect;
	range: Range | null;
}

const ExplainSelectionRegistryContext = createContext<Registry | null>(null);

interface ExplainSelectionProviderProps {
	children: React.ReactNode;
	createNewAgentSession: CreateNewAgentSession;
}

export function ExplainSelectionProvider({
	children,
	createNewAgentSession,
}: ExplainSelectionProviderProps) {
	const { t } = useLingui();
	const { hostUrl } = useWorkspaceClient();
	const queryClient = useQueryClient();
	const sources = useRef(new Map<Element, SourceRef>());
	const buttonRef = useRef<HTMLDivElement>(null);
	const [anchor, setAnchor] = useState<Anchor | null>(null);

	const registry = useMemo<Registry>(
		() => ({
			register: (element, source) => {
				sources.current.set(element, source);
				return () => {
					if (sources.current.get(element) === source) {
						sources.current.delete(element);
					}
				};
			},
		}),
		[],
	);

	const findSource = useCallback(
		(node: Node | null): ExplainSelectionSource | null => {
			for (
				let element = node instanceof Element ? node : node?.parentElement;
				element;
				element = element.parentElement
			) {
				const source = sources.current.get(element);
				if (source) return source.current;
			}
			return null;
		},
		[],
	);

	const readAnchor = useCallback(
		(target: Node | null, x: number, y: number): Anchor | null => {
			const targetSource = findSource(target);
			if (targetSource?.readSelection) {
				const text = targetSource.readSelection().trim();
				if (!text) return null;
				return {
					text,
					source: targetSource,
					rect: new DOMRect(x, y, 0, 0),
					range: null,
				};
			}
			const selection = document.getSelection();
			const text = selection?.toString().trim() ?? "";
			if (!text || !selection?.rangeCount) return null;
			if (document.activeElement?.matches("input, textarea")) return null;
			const range = selection.getRangeAt(0);
			return {
				text,
				source: findSource(range.commonAncestorContainer),
				rect: range.getBoundingClientRect(),
				range,
			};
		},
		[findSource],
	);

	useEffect(() => {
		const isOnButton = (target: EventTarget | null) =>
			target instanceof Node && Boolean(buttonRef.current?.contains(target));
		const onMouseDown = (event: MouseEvent) => {
			if (!isOnButton(event.target)) setAnchor(null);
		};
		const onMouseUp = (event: MouseEvent) => {
			if (event.button !== 0 || isOnButton(event.target)) return;
			const target = event.target instanceof Node ? event.target : null;
			const { clientX, clientY } = event;
			// xterm settles its selection in its own mouseup listener, after this one.
			window.setTimeout(() => setAnchor(readAnchor(target, clientX, clientY)));
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setAnchor(null);
		};
		const onSelectionChange = () => {
			setAnchor((current) =>
				current?.range && !document.getSelection()?.toString().trim()
					? null
					: current,
			);
		};
		const onScroll = () => {
			setAnchor((current) =>
				current?.range
					? { ...current, rect: current.range.getBoundingClientRect() }
					: current,
			);
		};
		document.addEventListener("mousedown", onMouseDown);
		document.addEventListener("mouseup", onMouseUp);
		document.addEventListener("keydown", onKeyDown);
		document.addEventListener("selectionchange", onSelectionChange);
		document.addEventListener("scroll", onScroll, true);
		return () => {
			document.removeEventListener("mousedown", onMouseDown);
			document.removeEventListener("mouseup", onMouseUp);
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("selectionchange", onSelectionChange);
			document.removeEventListener("scroll", onScroll, true);
		};
	}, [readAnchor]);

	const explain = useCallback(async () => {
		if (!anchor) return;
		setAnchor(null);
		const context = anchor.source
			? await anchor.source.readContext().catch(() => null)
			: null;
		const configs = await queryClient
			.ensureQueryData(v2AgentConfigsQueryOptions(hostUrl))
			.catch(() => []);
		const config =
			configs.find(
				(entry) =>
					context?.presetId !== undefined &&
					entry.presetId === context.presetId,
			) ?? configs[0];
		if (!config) {
			toast.error(t({ message: "No agents yet" }));
			return;
		}
		await createNewAgentSession({
			configId: config.id,
			placement: "split-pane",
			prompt: buildExplainSelectionPrompt({
				selection: anchor.text,
				context,
			}),
		});
	}, [anchor, createNewAgentSession, hostUrl, queryClient, t]);

	return (
		<ExplainSelectionRegistryContext.Provider value={registry}>
			{children}
			{anchor && (
				<ExplainSelectionButton
					ref={buttonRef}
					rect={anchor.rect}
					onExplain={() => void explain()}
				/>
			)}
		</ExplainSelectionRegistryContext.Provider>
	);
}

/** Lets a selection inside `elementRef` be explained with this surface's session as context. */
export function useExplainSelectionSource(
	elementRef: RefObject<HTMLElement | null>,
	source: ExplainSelectionSource,
): void {
	const registry = useContext(ExplainSelectionRegistryContext);
	const sourceRef = useRef(source);
	sourceRef.current = source;
	useEffect(() => {
		const element = elementRef.current;
		if (!registry || !element) return;
		return registry.register(element, sourceRef);
	}, [registry, elementRef]);
}
