import type {
	RoadmapAction,
	RoadmapView,
	RoadmapWorkTarget,
} from "@superset/shared/roadmap";
import { createContext, type ReactNode, useContext } from "react";

export interface RoadmapLiveTerminal {
	terminalId: string;
	title: string | null;
}

export interface RoadmapContextValue {
	workspaceId: string;
	roadmap: RoadmapView;
	apply: (actions: RoadmapAction[]) => Promise<boolean>;
	startWork: (input: {
		target: RoadmapWorkTarget;
		configId: string;
		instructions: string;
	}) => Promise<void>;
	liveTerminals: ReadonlyMap<string, RoadmapLiveTerminal>;
	focusTerminal: (terminalId: string) => void;
}

const RoadmapContext = createContext<RoadmapContextValue | null>(null);

export function RoadmapProvider({
	value,
	children,
}: {
	value: RoadmapContextValue;
	children: ReactNode;
}) {
	return (
		<RoadmapContext.Provider value={value}>{children}</RoadmapContext.Provider>
	);
}

export function useRoadmap(): RoadmapContextValue {
	const value = useContext(RoadmapContext);
	if (!value) throw new Error("useRoadmap must be used inside RoadmapProvider");
	return value;
}
