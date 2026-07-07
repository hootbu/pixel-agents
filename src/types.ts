import type * as vscode from 'vscode';

export interface UsageData {
	inputTokens: number;
	outputTokens: number;
	cacheCreationTokens: number;
	cacheReadTokens: number;
	model: string | null;
}

export interface AgentState {
	id: number;
	name: string;
	terminalRef: vscode.Terminal;
	projectDir: string;
	jsonlFile: string;
	fileOffset: number;
	lineBuffer: string;
	activeToolIds: Set<string>;
	activeToolStatuses: Map<string, string>;
	activeToolNames: Map<string, string>;
	activeSubagentToolIds: Map<string, Set<string>>; // parentToolId → active sub-tool IDs
	activeSubagentToolNames: Map<string, Map<string, string>>; // parentToolId → (subToolId → toolName)
	asyncAgentToolIds: Set<string>; // Agent tool IDs launched in background; kept alive until their task-notification
	subagentWatches: Map<string, SubagentWatch>; // parentToolId → watcher for the spawned agent's own transcript file
	earlyCompletionToolIds: Set<string>;
	isWaiting: boolean;
	permissionSent: boolean;
	hadToolsInTurn: boolean;
	usage: UsageData;
	lastToolStartTime: number;
	recentToolStarts: number[];
	errorCountInTurn: number;
}

/**
 * Watches a spawned sub-agent's own transcript file
 * (`<project>/<session>/subagents/agent-a<Name>-<hash>.jsonl`) so its live tool
 * activity can be forwarded to the webview as subagentToolStart/Done messages.
 */
export interface SubagentWatch {
	parentToolId: string;
	name: string;
	filePath: string | null;   // resolved once the sub-agent's file is found on disk
	fileOffset: number;
	lineBuffer: string;
	watcher: { close(): void } | null;
	poll: ReturnType<typeof setInterval> | null;
	findTimer: ReturnType<typeof setInterval> | null; // retries locating the file until it exists
}

export interface PersistedAgent {
	id: number;
	name: string;
	terminalName: string;
	jsonlFile: string;
	projectDir: string;
}
