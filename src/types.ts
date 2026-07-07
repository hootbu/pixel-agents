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
	earlyCompletionToolIds: Set<string>;
	isWaiting: boolean;
	permissionSent: boolean;
	hadToolsInTurn: boolean;
	usage: UsageData;
	lastToolStartTime: number;
	recentToolStarts: number[];
	errorCountInTurn: number;
}

export interface PersistedAgent {
	id: number;
	name: string;
	terminalName: string;
	jsonlFile: string;
	projectDir: string;
}
