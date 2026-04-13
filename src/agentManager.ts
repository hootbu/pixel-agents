import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import type { AgentState, PersistedAgent } from './types.js';
import { cancelWaitingTimer, cancelPermissionTimer } from './timerManager.js';
import { startFileWatching, readNewLines, ensureProjectScan } from './fileWatcher.js';
import { JSONL_POLL_INTERVAL_MS, TERMINAL_NAME_PREFIX, WORKSPACE_KEY_AGENTS, WORKSPACE_KEY_AGENT_SEATS, WORKSPACE_KEY_AGENT_NAMES } from './constants.js';
import { migrateAndLoadLayout } from './layoutPersistence.js';

export function getProjectDirPath(cwd?: string): string | null {
	const workspacePath = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspacePath) {return null;}
	const dirName = workspacePath.replace(/[^a-zA-Z0-9]/g, '-');
	return path.join(os.homedir(), '.claude', 'projects', dirName);
}

export async function launchNewTerminal(
	nextAgentIdRef: { current: number },
	nextTerminalIndexRef: { current: number },
	agents: Map<number, AgentState>,
	activeAgentIdRef: { current: number | null },
	knownJsonlFiles: Set<string>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	projectScanTimerRef: { current: ReturnType<typeof setInterval> | null },
	webview: vscode.Webview | undefined,
	persistAgents: () => void,
	context: vscode.ExtensionContext,
): Promise<void> {
	// Ask user for agent name
	const name = await vscode.window.showInputBox({
		prompt: 'Agent name (nickname)',
		placeHolder: 'e.g. Alice, Bob, Frontend-Dev...',
	});
	if (!name) {return;} // user cancelled

	const idx = nextTerminalIndexRef.current++;
	const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	const terminal = vscode.window.createTerminal({
		name,
		cwd,
	});
	terminal.show();

	const sessionId = crypto.randomUUID();
	terminal.sendText(`claude --session-id ${sessionId}`);

	const projectDir = getProjectDirPath(cwd);
	if (!projectDir) {
		console.log(`[Pixel Agents] No project dir, cannot track agent`);
		return;
	}

	// Pre-register expected JSONL file so project scan won't treat it as a /clear file
	const expectedFile = path.join(projectDir, `${sessionId}.jsonl`);
	knownJsonlFiles.add(expectedFile);

	// Look up persisted name data (palette, hueShift, seatId) for this name
	const agentNames = context.workspaceState.get<Record<string, { seatId: string; palette: number; hueShift: number }>>(WORKSPACE_KEY_AGENT_NAMES, {});
	const nameData = agentNames[name] ?? null;

	// Create agent immediately (before JSONL file exists)
	const id = nextAgentIdRef.current++;
	const agent: AgentState = {
		id,
		name,
		terminalRef: terminal,
		projectDir,
		jsonlFile: expectedFile,
		fileOffset: 0,
		lineBuffer: '',
		activeToolIds: new Set(),
		activeToolStatuses: new Map(),
		activeToolNames: new Map(),
		activeSubagentToolIds: new Map(),
		activeSubagentToolNames: new Map(),
		earlyCompletionToolIds: new Set(),
		isWaiting: false,
		permissionSent: false,
		hadToolsInTurn: false,
		usage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, model: null },
		lastToolStartTime: 0,
		recentToolStarts: [],
		errorCountInTurn: 0,
	};

	agents.set(id, agent);
	activeAgentIdRef.current = id;
	persistAgents();
	console.log(`[Pixel Agents] Agent ${id} (${name}): created for terminal ${terminal.name}`);
	webview?.postMessage({ type: 'agentCreated', id, name, nameData });

	ensureProjectScan(
		projectDir, knownJsonlFiles, projectScanTimerRef, activeAgentIdRef,
		nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers,
		webview, persistAgents,
	);

	// Poll for the specific JSONL file to appear
	const pollTimer = setInterval(() => {
		try {
			if (fs.existsSync(agent.jsonlFile)) {
				console.log(`[Pixel Agents] Agent ${id}: found JSONL file ${path.basename(agent.jsonlFile)}`);
				clearInterval(pollTimer);
				jsonlPollTimers.delete(id);
				startFileWatching(id, agent.jsonlFile, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, webview);
				readNewLines(id, agents, waitingTimers, permissionTimers, webview);
			}
		} catch { /* file may not exist yet */ }
	}, JSONL_POLL_INTERVAL_MS);
	jsonlPollTimers.set(id, pollTimer);
}

export function removeAgent(
	agentId: number,
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	persistAgents: () => void,
): void {
	const agent = agents.get(agentId);
	if (!agent) {return;}

	// Stop JSONL poll timer
	const jpTimer = jsonlPollTimers.get(agentId);
	if (jpTimer) { clearInterval(jpTimer); }
	jsonlPollTimers.delete(agentId);

	// Stop file watching
	fileWatchers.get(agentId)?.close();
	fileWatchers.delete(agentId);
	const pt = pollingTimers.get(agentId);
	if (pt) { clearInterval(pt); }
	pollingTimers.delete(agentId);

	// Cancel timers
	cancelWaitingTimer(agentId, waitingTimers);
	cancelPermissionTimer(agentId, permissionTimers);

	// Remove from maps
	agents.delete(agentId);
	persistAgents();
}

export function persistAgents(
	agents: Map<number, AgentState>,
	context: vscode.ExtensionContext,
): void {
	const persisted: PersistedAgent[] = [];
	for (const agent of agents.values()) {
		persisted.push({
			id: agent.id,
			name: agent.name,
			terminalName: agent.terminalRef.name,
			jsonlFile: agent.jsonlFile,
			projectDir: agent.projectDir,
		});
	}
	context.workspaceState.update(WORKSPACE_KEY_AGENTS, persisted);
}

export function restoreAgents(
	context: vscode.ExtensionContext,
	nextAgentIdRef: { current: number },
	nextTerminalIndexRef: { current: number },
	agents: Map<number, AgentState>,
	knownJsonlFiles: Set<string>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	projectScanTimerRef: { current: ReturnType<typeof setInterval> | null },
	activeAgentIdRef: { current: number | null },
	webview: vscode.Webview | undefined,
	doPersist: () => void,
): void {
	const persisted = context.workspaceState.get<PersistedAgent[]>(WORKSPACE_KEY_AGENTS, []);
	if (persisted.length === 0) {return;}

	const liveTerminals = vscode.window.terminals;
	let maxId = 0;
	let maxIdx = 0;
	let restoredProjectDir: string | null = null;

	for (const p of persisted) {
		const terminal = liveTerminals.find(t => t.name === p.terminalName);
		if (!terminal) {continue;}

		// Migrate: re-derive paths with current (fixed) sanitizer in case old paths used wrong convention
		let resolvedProjectDir = p.projectDir;
		let resolvedJsonlFile = p.jsonlFile;
		if (!fs.existsSync(p.jsonlFile)) {
			const correctedDir = getProjectDirPath();
			if (correctedDir) {
				const sessionId = path.basename(p.jsonlFile, '.jsonl');
				const correctedFile = path.join(correctedDir, `${sessionId}.jsonl`);
				if (fs.existsSync(correctedFile)) {
					console.log(`[Pixel Agents] Migrating agent ${p.id} path: ${p.jsonlFile} → ${correctedFile}`);
					resolvedProjectDir = correctedDir;
					resolvedJsonlFile = correctedFile;
				}
			}
		}

		const agent: AgentState = {
			id: p.id,
			name: p.name || `Agent ${p.id}`,
			terminalRef: terminal,
			projectDir: resolvedProjectDir,
			jsonlFile: resolvedJsonlFile,
			fileOffset: 0,
			lineBuffer: '',
			activeToolIds: new Set(),
			activeToolStatuses: new Map(),
			activeToolNames: new Map(),
			activeSubagentToolIds: new Map(),
			activeSubagentToolNames: new Map(),
			earlyCompletionToolIds: new Set(),
			isWaiting: false,
			permissionSent: false,
			hadToolsInTurn: false,
			usage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, model: null },
			lastToolStartTime: 0,
			recentToolStarts: [],
			errorCountInTurn: 0,
		};

		agents.set(p.id, agent);
		knownJsonlFiles.add(resolvedJsonlFile);
		console.log(`[Pixel Agents] Restored agent ${p.id} → terminal "${p.terminalName}"`);

		if (p.id > maxId) {maxId = p.id;}
		// Extract terminal index from name like "Claude Code #3"
		const match = p.terminalName.match(/#(\d+)$/);
		if (match) {
			const idx = parseInt(match[1], 10);
			if (idx > maxIdx) {maxIdx = idx;}
		}

		restoredProjectDir = resolvedProjectDir;

		// Start file watching if JSONL exists, skipping to end of file
		try {
			if (fs.existsSync(resolvedJsonlFile)) {
				const stat = fs.statSync(resolvedJsonlFile);
				replayUsageFromJsonl(p.id, agent, resolvedJsonlFile);
				agent.fileOffset = stat.size;
				startFileWatching(p.id, resolvedJsonlFile, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, webview);
			} else {
				// Poll for the file to appear
				const pollTimer = setInterval(() => {
					try {
						if (fs.existsSync(agent.jsonlFile)) {
							console.log(`[Pixel Agents] Restored agent ${p.id}: found JSONL file`);
							clearInterval(pollTimer);
							jsonlPollTimers.delete(p.id);
							const stat = fs.statSync(agent.jsonlFile);
							replayUsageFromJsonl(p.id, agent, agent.jsonlFile);
							agent.fileOffset = stat.size;
							startFileWatching(p.id, agent.jsonlFile, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, webview);
						}
					} catch { /* file may not exist yet */ }
				}, JSONL_POLL_INTERVAL_MS);
				jsonlPollTimers.set(p.id, pollTimer);
			}
		} catch { /* ignore errors during restore */ }
	}

	// Advance counters past restored IDs
	if (maxId >= nextAgentIdRef.current) {
		nextAgentIdRef.current = maxId + 1;
	}
	if (maxIdx >= nextTerminalIndexRef.current) {
		nextTerminalIndexRef.current = maxIdx + 1;
	}

	// Re-persist cleaned-up list (removes entries whose terminals are gone)
	doPersist();

	// Start project scan for /clear detection
	if (restoredProjectDir) {
		ensureProjectScan(
			restoredProjectDir, knownJsonlFiles, projectScanTimerRef, activeAgentIdRef,
			nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers,
			webview, doPersist,
		);
	}
}

export function sendExistingAgents(
	agents: Map<number, AgentState>,
	context: vscode.ExtensionContext,
	webview: vscode.Webview | undefined,
): void {
	if (!webview) {return;}
	const agentIds: number[] = [];
	for (const id of agents.keys()) {
		agentIds.push(id);
	}
	agentIds.sort((a, b) => a - b);

	// Include persisted palette/seatId from separate key
	const agentMeta = context.workspaceState.get<Record<string, { palette?: number; seatId?: string }>>(WORKSPACE_KEY_AGENT_SEATS, {});

	// Build name map from live agents
	const agentNameMap: Record<number, string> = {};
	for (const [id, agent] of agents) {
		agentNameMap[id] = agent.name;
	}

	// Also include persisted name → seat data
	const agentNames = context.workspaceState.get<Record<string, { seatId: string; palette: number; hueShift: number }>>(WORKSPACE_KEY_AGENT_NAMES, {});
	console.log(`[Pixel Agents] sendExistingAgents: agents=${JSON.stringify(agentIds)}, meta=${JSON.stringify(agentMeta)}, names=${JSON.stringify(agentNameMap)}`);

	webview.postMessage({
		type: 'existingAgents',
		agents: agentIds,
		agentMeta,
		agentNameMap,
		agentNames,
	});

	sendCurrentAgentStatuses(agents, webview);
}

export function sendCurrentAgentStatuses(
	agents: Map<number, AgentState>,
	webview: vscode.Webview | undefined,
): void {
	if (!webview) {return;}
	for (const [agentId, agent] of agents) {
		// Re-send active tools
		for (const [toolId, status] of agent.activeToolStatuses) {
			webview.postMessage({
				type: 'agentToolStart',
				id: agentId,
				toolId,
				status,
			});
		}
		// Re-send waiting status
		if (agent.isWaiting) {
			webview.postMessage({
				type: 'agentStatus',
				id: agentId,
				status: 'waiting',
			});
		}
		// Re-send accumulated usage data
		const u = agent.usage;
		if (u.inputTokens > 0 || u.outputTokens > 0 || u.cacheCreationTokens > 0 || u.cacheReadTokens > 0) {
			webview.postMessage({
				type: 'agentUsageUpdate',
				id: agentId,
				usage: {
					inputTokens: u.inputTokens,
					outputTokens: u.outputTokens,
					cacheCreationTokens: u.cacheCreationTokens,
					cacheReadTokens: u.cacheReadTokens,
					totalTokens: u.inputTokens + u.outputTokens + u.cacheCreationTokens + u.cacheReadTokens,
					model: u.model,
				},
			});
		}
	}
}

function replayUsageFromJsonl(agentId: number, agent: AgentState, jsonlFile: string): void {
	try {
		const content = fs.readFileSync(jsonlFile, 'utf-8');
		const lines = content.split('\n');
		for (const line of lines) {
			if (!line.trim()) {continue;}
			try {
				const record = JSON.parse(line);
				if (record.type === 'assistant' && Array.isArray(record.message?.content)) {
					const usage = record.message.usage as {
						input_tokens?: number;
						output_tokens?: number;
						cache_creation_input_tokens?: number;
						cache_read_input_tokens?: number;
					} | undefined;
					if (usage) {
						agent.usage.inputTokens += usage.input_tokens || 0;
						agent.usage.outputTokens += usage.output_tokens || 0;
						agent.usage.cacheCreationTokens += usage.cache_creation_input_tokens || 0;
						agent.usage.cacheReadTokens += usage.cache_read_input_tokens || 0;
					}
					const model = record.message.model as string | undefined;
					if (model) {agent.usage.model = model;}
				}
			} catch { /* skip malformed lines */ }
		}
		console.log(`[Pixel Agents] Agent ${agentId}: replayed usage from JSONL — in=${agent.usage.inputTokens} out=${agent.usage.outputTokens}`);
	} catch { /* file unreadable, skip */ }
}

export function sendLayout(
	context: vscode.ExtensionContext,
	webview: vscode.Webview | undefined,
	defaultLayout?: Record<string, unknown> | null,
): void {
	if (!webview) {return;}
	const layout = migrateAndLoadLayout(context, defaultLayout);
	webview.postMessage({
		type: 'layoutLoaded',
		layout,
	});
}
