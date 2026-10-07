import { useLingui } from "@lingui/react/macro";
import { buildCreateFromSelectionPrompt } from "@superset/shared/roadmap";
import {
	buildAskSelectionDraft,
	buildExplainSelectionPrompt,
	buildForkFromHerePrompt,
	quoteSelection,
	type SelectionSessionContext,
} from "@superset/shared/terminal-session-handoff";
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
import {
	type SelectionAction,
	SelectionActionsToolbar,
} from "./components/SelectionActionsToolbar";

export interface SelectionContext extends SelectionSessionContext {
	/** Agent config id or preset id; the side session uses the same agent. */
	agentId?: string;
}

export interface SelectionPoint {
	text: string;
	/** Absent for surfaces that keep their selection outside the DOM. */
	range: Range | null;
}

export interface SelectionActionSource {
	agentId?: string;
	/** For surfaces that keep their selection outside the DOM, such as xterm. */
	readSelection?: () => string;
	readContext: () => Promise<SelectionContext | null>;
	/** Puts text in this surface's own input without sending it. */
	insertText?: (text: string) => void;
	/** The session up to the end of the selection. */
	readContextUpTo?: (point: SelectionPoint) => Promise<SelectionContext | null>;
}

type SourceRef = RefObject<SelectionActionSource>;

interface Registry {
	register: (element: HTMLElement, source: SourceRef) => () => void;
}

interface Anchor extends SelectionPoint {
	source: SelectionActionSource | null;
	rect: DOMRect;
}

const IGNORE_SELECTOR = "[data-selection-actions-ignore]";

const SelectionActionsRegistryContext = createContext<Registry | null>(null);

interface SelectionActionsProviderProps {
	children: React.ReactNode;
	createNewAgentSession: CreateNewAgentSession;
}

export function SelectionActionsProvider({
	children,
	createNewAgentSession,
}: SelectionActionsProviderProps) {
	const { t } = useLingui();
	const { hostUrl } = useWorkspaceClient();
	const queryClient = useQueryClient();
	const sources = useRef(new Map<Element, SourceRef>());
	const toolbarRef = useRef<HTMLDivElement>(null);
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
		(node: Node | null): SelectionActionSource | null => {
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

	const readDomAnchor = useCallback((): Anchor | null => {
		const selection = document.getSelection();
		const text = selection?.toString().trim() ?? "";
		if (!text || !selection?.rangeCount) return null;
		if (document.activeElement?.matches("input, textarea")) return null;
		const range = selection.getRangeAt(0);
		const container = range.commonAncestorContainer;
		const element =
			container instanceof Element ? container : container.parentElement;
		if (element?.closest(IGNORE_SELECTOR)) return null;
		return {
			text,
			range,
			source: findSource(container),
			rect: range.getBoundingClientRect(),
		};
	}, [findSource]);

	useEffect(() => {
		const isOnToolbar = (target: EventTarget | null) =>
			target instanceof Node && Boolean(toolbarRef.current?.contains(target));
		const onMouseDown = (event: MouseEvent) => {
			if (!isOnToolbar(event.target)) setAnchor(null);
		};
		const onMouseUp = (event: MouseEvent) => {
			if (event.button !== 0 || isOnToolbar(event.target)) return;
			const target = event.target instanceof Node ? event.target : null;
			const { clientX, clientY } = event;
			// xterm settles its selection in its own mouseup listener, after this one.
			window.setTimeout(() => {
				const source = findSource(target);
				if (!source?.readSelection) {
					setAnchor(readDomAnchor());
					return;
				}
				const text = source.readSelection().trim();
				setAnchor(
					text
						? {
								text,
								range: null,
								source,
								rect: new DOMRect(clientX, clientY, 0, 0),
							}
						: null,
				);
			});
		};
		const onKeyUp = (event: KeyboardEvent) => {
			if (!event.shiftKey && !event.key.startsWith("Arrow")) return;
			// Releasing Shift after a Shift+drag in a terminal must keep its toolbar.
			if (document.getSelection()?.isCollapsed !== false) return;
			setAnchor(readDomAnchor());
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
		document.addEventListener("keyup", onKeyUp);
		document.addEventListener("keydown", onKeyDown);
		document.addEventListener("selectionchange", onSelectionChange);
		document.addEventListener("scroll", onScroll, true);
		return () => {
			document.removeEventListener("mousedown", onMouseDown);
			document.removeEventListener("mouseup", onMouseUp);
			document.removeEventListener("keyup", onKeyUp);
			document.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("selectionchange", onSelectionChange);
			document.removeEventListener("scroll", onScroll, true);
		};
	}, [findSource, readDomAnchor]);

	const resolveConfig = useCallback(
		async (agentId: string | undefined) => {
			const configs = await queryClient
				.ensureQueryData(v2AgentConfigsQueryOptions(hostUrl))
				.catch(() => []);
			const config =
				configs.find(
					(entry) => entry.id === agentId || entry.presetId === agentId,
				) ?? configs[0];
			if (!config) toast.error(t({ message: "No agents yet" }));
			return config;
		},
		[hostUrl, queryClient, t],
	);

	const run = useCallback(
		async (action: SelectionAction, target: Anchor) => {
			const { source, text } = target;
			if (action === "add") {
				source?.insertText?.(`${quoteSelection(text)}\n\n`);
				return;
			}
			if (action === "ask") {
				const configId = (await resolveConfig(source?.agentId))?.id;
				if (!configId) return;
				await createNewAgentSession({
					configId,
					placement: "split-pane",
					prompt: "",
					draft: buildAskSelectionDraft(text),
				});
				return;
			}
			if (action === "task" || action === "plan") {
				const config = await resolveConfig(source?.agentId);
				if (!config) return;
				await createNewAgentSession({
					configId: config.id,
					placement: "split-pane",
					prompt: buildCreateFromSelectionPrompt({
						kind: action,
						selection: text,
						source: source
							? `a ${config.label} session in this workspace`
							: undefined,
					}),
				});
				return;
			}
			if (action === "details") {
				const context = source
					? await source.readContext().catch(() => null)
					: null;
				const configId = (
					await resolveConfig(context?.agentId ?? source?.agentId)
				)?.id;
				if (!configId) return;
				await createNewAgentSession({
					configId,
					placement: "split-pane",
					prompt: buildExplainSelectionPrompt({ selection: text, context }),
				});
				return;
			}
			if (action !== "fork") {
				const unhandled: never = action;
				return unhandled;
			}
			const context = await source?.readContextUpTo?.(target).catch(() => null);
			if (!context) {
				toast.error(t({ message: "Couldn't read the session to fork it" }));
				return;
			}
			const configId = (await resolveConfig(context.agentId ?? source?.agentId))
				?.id;
			if (!configId) return;
			await createNewAgentSession({
				configId,
				placement: "new-tab",
				prompt: buildForkFromHerePrompt(context),
			});
		},
		[createNewAgentSession, resolveConfig, t],
	);

	const actions = useMemo<SelectionAction[]>(() => {
		if (!anchor) return [];
		return [
			...(anchor.source?.insertText ? (["add"] as const) : []),
			"ask",
			"details",
			"task",
			"plan",
			...(anchor.source?.readContextUpTo ? (["fork"] as const) : []),
		];
	}, [anchor]);

	return (
		<SelectionActionsRegistryContext.Provider value={registry}>
			{children}
			{anchor && (
				<SelectionActionsToolbar
					ref={toolbarRef}
					rect={anchor.rect}
					actions={actions}
					onAction={(action) => {
						setAnchor(null);
						if (anchor.range) document.getSelection()?.removeAllRanges();
						void run(action, anchor);
					}}
				/>
			)}
		</SelectionActionsRegistryContext.Provider>
	);
}

/** Offers the selection toolbar for selections inside `elementRef`, with this surface's session as context. */
export function useSelectionActionSource(
	elementRef: RefObject<HTMLElement | null>,
	source: SelectionActionSource,
): void {
	const registry = useContext(SelectionActionsRegistryContext);
	const sourceRef = useRef(source);
	sourceRef.current = source;
	useEffect(() => {
		const element = elementRef.current;
		if (!registry || !element) return;
		return registry.register(element, sourceRef);
	}, [registry, elementRef]);
}
