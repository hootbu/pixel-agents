import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { AgentState } from './types.js';
import { cancelWaitingTimer, cancelPermissionTimer, clearAgentActivity } from './timerManager.js';
import { processTranscriptLine, formatToolStatus } from './transcriptParser.js';
import type { AchievementHooks } from './transcriptParser.js';
import type { SubagentWatch } from './types.js';

let globalAchievementHooks: AchievementHooks | undefined;

export function setAchievementHooks(hooks: AchievementHooks): void {
	globalAchievementHooks = hooks;
}

// Byte size each known-but-unowned JSONL had when first seen. A file that grows
// past this after the extension started is a live external session still being
// written to — the terminal the user is actually chatting in — so we adopt it
// retroactively (the seed step alone would otherwise ignore it forever).
const externalFileSeedSizes = new Map<string, number>();

function jsonlSize(file: string): number {
	try { return fs.statSync(file).size; } catch { return 0; }
}

function isFileOwned(file: string, agents: Map<number, AgentState>): boolean {
	for (const agent of agents.values()) {
		if (agent.jsonlFile === file) {return true;}
	}
	return false;
}
import { FILE_WATCHER_POLL_INTERVAL_MS, PROJECT_SCAN_INTERVAL_MS, SUBAGENT_FIND_RETRY_MS, SUBAGENT_FIND_MAX_RETRIES } from './constants.js';

// ── Sub-agent transcript watching ────────────────────────────────
// A spawned agent (background/teammate) writes its own tool activity to
// `<project>/<parentSession>/subagents/agent-a<Name>-<hash>.jsonl`, NOT the parent
// transcript. We locate that file by matching the sub-agent name against the
// sibling `.meta.json` files, then forward its tool_use/tool_result records to the
// webview as the same subagentToolStart/Done messages the sync path already uses —
// so the sub-agent character animates and its activity shows in the Tasks panel.

function subagentsDir(jsonlFile: string): string {
	return path.join(path.dirname(jsonlFile), path.basename(jsonlFile, '.jsonl'), 'subagents');
}

/** Find a spawned agent's transcript by matching its name against the *.meta.json files. */
function findSubagentFile(dir: string, name: string): string | null {
	let entries: string[];
	try { entries = fs.readdirSync(dir); } catch { return null; }
	for (const f of entries) {
		if (!f.endsWith('.meta.json')) { continue; }
		try {
			const meta = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as { name?: string };
			if (meta.name === name) {
				return path.join(dir, f.replace(/\.meta\.json$/, '.jsonl'));
			}
		} catch { /* unreadable/partial meta — skip */ }
	}
	return null;
}

export function startSubagentWatch(agent: AgentState, parentToolId: string, name: string, webview: vscode.Webview | undefined): void {
	if (agent.subagentWatches.has(parentToolId)) { return; }
	const watch: SubagentWatch = {
		parentToolId, name, filePath: null, fileOffset: 0, lineBuffer: '',
		watcher: null, poll: null, findTimer: null,
	};
	agent.subagentWatches.set(parentToolId, watch);

	const dir = subagentsDir(agent.jsonlFile);
	const attach = (): boolean => {
		const file = findSubagentFile(dir, name);
		if (!file) { return false; }
		watch.filePath = file;
		beginSubagentWatching(agent.id, watch, webview);
		return true;
	};
	if (attach()) { return; }
	// The transcript file may not be written yet — retry for a short while.
	let attempts = 0;
	watch.findTimer = setInterval(() => {
		attempts++;
		if (attach() || attempts >= SUBAGENT_FIND_MAX_RETRIES) {
			if (watch.findTimer) { clearInterval(watch.findTimer); watch.findTimer = null; }
		}
	}, SUBAGENT_FIND_RETRY_MS);
}

function beginSubagentWatching(agentId: number, watch: SubagentWatch, webview: vscode.Webview | undefined): void {
	if (!watch.filePath) { return; }
	try {
		watch.watcher = fs.watch(watch.filePath, () => readSubagentLines(agentId, watch, webview));
	} catch { /* fs.watch may fail (e.g. Windows) — polling backup covers it */ }
	watch.poll = setInterval(() => readSubagentLines(agentId, watch, webview), FILE_WATCHER_POLL_INTERVAL_MS);
	readSubagentLines(agentId, watch, webview);
}

function readSubagentLines(agentId: number, watch: SubagentWatch, webview: vscode.Webview | undefined): void {
	if (!watch.filePath) { return; }
	try {
		const stat = fs.statSync(watch.filePath);
		if (stat.size <= watch.fileOffset) { return; }
		const buf = Buffer.alloc(stat.size - watch.fileOffset);
		const fd = fs.openSync(watch.filePath, 'r');
		fs.readSync(fd, buf, 0, buf.length, watch.fileOffset);
		fs.closeSync(fd);
		watch.fileOffset = stat.size;
		const text = watch.lineBuffer + buf.toString('utf-8');
		const lines = text.split('\n');
		watch.lineBuffer = lines.pop() || '';
		for (const line of lines) {
			if (line.trim()) { parseSubagentLine(agentId, watch.parentToolId, line, webview); }
		}
	} catch (e) {
		console.log(`[Pixel Agents] Sub-agent read error (${watch.name}): ${e}`);
	}
}

function parseSubagentLine(agentId: number, parentToolId: string, line: string, webview: vscode.Webview | undefined): void {
	let record: { type?: string; message?: { content?: unknown } };
	try { record = JSON.parse(line); } catch { return; }
	const content = record.message?.content;
	if (!Array.isArray(content)) { return; }
	const blocks = content as Array<{ type?: string; id?: string; name?: string; input?: Record<string, unknown>; tool_use_id?: string }>;
	if (record.type === 'assistant') {
		for (const block of blocks) {
			if (block.type === 'tool_use' && block.id) {
				webview?.postMessage({
					type: 'subagentToolStart',
					id: agentId,
					parentToolId,
					toolId: block.id,
					status: formatToolStatus(block.name || '', block.input || {}),
				});
			}
		}
	} else if (record.type === 'user') {
		for (const block of blocks) {
			if (block.type === 'tool_result' && block.tool_use_id) {
				webview?.postMessage({
					type: 'subagentToolDone',
					id: agentId,
					parentToolId,
					toolId: block.tool_use_id,
				});
			}
		}
	}
}

export function stopSubagentWatch(agent: AgentState, parentToolId: string): void {
	const watch = agent.subagentWatches.get(parentToolId);
	if (!watch) { return; }
	watch.watcher?.close();
	if (watch.poll) { clearInterval(watch.poll); }
	if (watch.findTimer) { clearInterval(watch.findTimer); }
	agent.subagentWatches.delete(parentToolId);
}

export function startFileWatching(
	agentId: number,
	filePath: string,
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	webview: vscode.Webview | undefined,
): void {
	// Primary: fs.watch
	try {
		const watcher = fs.watch(filePath, () => {
			readNewLines(agentId, agents, waitingTimers, permissionTimers, webview);
		});
		fileWatchers.set(agentId, watcher);
	} catch (e) {
		console.log(`[Pixel Agents] fs.watch failed for agent ${agentId}: ${e}`);
	}

	// Backup: poll every 2s
	const interval = setInterval(() => {
		if (!agents.has(agentId)) { clearInterval(interval); return; }
		readNewLines(agentId, agents, waitingTimers, permissionTimers, webview);
	}, FILE_WATCHER_POLL_INTERVAL_MS);
	pollingTimers.set(agentId, interval);
}

export function readNewLines(
	agentId: number,
	agents: Map<number, AgentState>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	webview: vscode.Webview | undefined,
): void {
	const agent = agents.get(agentId);
	if (!agent) {return;}
	try {
		const stat = fs.statSync(agent.jsonlFile);
		if (stat.size <= agent.fileOffset) {return;}

		const buf = Buffer.alloc(stat.size - agent.fileOffset);
		const fd = fs.openSync(agent.jsonlFile, 'r');
		fs.readSync(fd, buf, 0, buf.length, agent.fileOffset);
		fs.closeSync(fd);
		agent.fileOffset = stat.size;

		const text = agent.lineBuffer + buf.toString('utf-8');
		const lines = text.split('\n');
		agent.lineBuffer = lines.pop() || '';

		const hasLines = lines.some(l => l.trim());
		if (hasLines) {
			// New data arriving — cancel permission timer (data flowing means tool is not stuck)
			// NOTE: waiting timer is NOT cancelled here — processTranscriptLine handles it
			// on assistant/user records to avoid resetting text-only turn detection
			cancelPermissionTimer(agentId, permissionTimers);
			if (agent.permissionSent) {
				agent.permissionSent = false;
				webview?.postMessage({ type: 'agentToolPermissionClear', id: agentId });
			}
		}

		for (const line of lines) {
			if (!line.trim()) {continue;}
			processTranscriptLine(agentId, line, agents, waitingTimers, permissionTimers, webview, globalAchievementHooks);
		}
	} catch (e) {
		console.log(`[Pixel Agents] Read error for agent ${agentId}: ${e}`);
	}
}

export function ensureProjectScan(
	projectDir: string,
	knownJsonlFiles: Set<string>,
	projectScanTimerRef: { current: ReturnType<typeof setInterval> | null },
	activeAgentIdRef: { current: number | null },
	nextAgentIdRef: { current: number },
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	webview: vscode.Webview | undefined,
	persistAgents: () => void,
): void {
	if (projectScanTimerRef.current) {return;}
	// Seed with all existing JSONL files so we only react to truly new ones
	try {
		const files = fs.readdirSync(projectDir)
			.filter(f => f.endsWith('.jsonl'))
			.map(f => path.join(projectDir, f));
		for (const f of files) {
			knownJsonlFiles.add(f);
			externalFileSeedSizes.set(f, jsonlSize(f));
		}
	} catch { /* dir may not exist yet */ }

	projectScanTimerRef.current = setInterval(() => {
		scanForNewJsonlFiles(
			projectDir, knownJsonlFiles, activeAgentIdRef, nextAgentIdRef,
			agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers,
			webview, persistAgents,
		);
	}, PROJECT_SCAN_INTERVAL_MS);
}

function scanForNewJsonlFiles(
	projectDir: string,
	knownJsonlFiles: Set<string>,
	activeAgentIdRef: { current: number | null },
	nextAgentIdRef: { current: number },
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	webview: vscode.Webview | undefined,
	persistAgents: () => void,
): void {
	let files: string[];
	try {
		files = fs.readdirSync(projectDir)
			.filter(f => f.endsWith('.jsonl'))
			.map(f => path.join(projectDir, f));
	} catch { return; }

	for (const file of files) {
		if (!knownJsonlFiles.has(file)) {
			knownJsonlFiles.add(file);
			externalFileSeedSizes.set(file, jsonlSize(file));
			if (activeAgentIdRef.current !== null) {
				// Active agent focused → /clear reassignment
				console.log(`[Pixel Agents] New JSONL detected: ${path.basename(file)}, reassigning to agent ${activeAgentIdRef.current}`);
				reassignAgentToFile(
					activeAgentIdRef.current, file,
					agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers,
					webview, persistAgents,
				);
			} else {
				// No active agent → try to adopt the focused terminal
				tryAdoptActiveTerminal(
					file, projectDir, 0, nextAgentIdRef, agents, activeAgentIdRef,
					fileWatchers, pollingTimers, waitingTimers, permissionTimers,
					webview, persistAgents,
				);
			}
		} else if (activeAgentIdRef.current === null && !isFileOwned(file, agents)) {
			// Known but unowned. If it has grown since the extension started, it is a
			// live external session (the terminal the user is chatting in) that the seed
			// step skipped — adopt the focused terminal retroactively. Start reading from
			// the SEED offset (where we began watching), not the end: the very growth that
			// triggers adoption often contains the Agent-spawn records, and reading from
			// the end would skip them so no sub-agent characters would ever appear. Reading
			// from seed replays only activity since the panel opened, not ancient history.
			const seed = externalFileSeedSizes.get(file);
			const size = jsonlSize(file);
			if (seed !== undefined && size > seed) {
				tryAdoptActiveTerminal(
					file, projectDir, seed, nextAgentIdRef, agents, activeAgentIdRef,
					fileWatchers, pollingTimers, waitingTimers, permissionTimers,
					webview, persistAgents,
				);
			}
		}
	}
}

/** Adopt the focused terminal for a file, if there is one not already owning an agent. */
function tryAdoptActiveTerminal(
	file: string,
	projectDir: string,
	initialOffset: number,
	nextAgentIdRef: { current: number },
	agents: Map<number, AgentState>,
	activeAgentIdRef: { current: number | null },
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	webview: vscode.Webview | undefined,
	persistAgents: () => void,
): void {
	const activeTerminal = vscode.window.activeTerminal;
	if (!activeTerminal) {return;}
	for (const agent of agents.values()) {
		if (agent.terminalRef === activeTerminal) {return;} // already owned
	}
	externalFileSeedSizes.delete(file);
	adoptTerminalForFile(
		activeTerminal, file, projectDir, initialOffset,
		nextAgentIdRef, agents, activeAgentIdRef,
		fileWatchers, pollingTimers, waitingTimers, permissionTimers,
		webview, persistAgents,
	);
}

function adoptTerminalForFile(
	terminal: vscode.Terminal,
	jsonlFile: string,
	projectDir: string,
	initialOffset: number,
	nextAgentIdRef: { current: number },
	agents: Map<number, AgentState>,
	activeAgentIdRef: { current: number | null },
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	webview: vscode.Webview | undefined,
	persistAgents: () => void,
): void {
	const id = nextAgentIdRef.current++;
	const name = terminal.name || `Agent ${id}`;
	const agent: AgentState = {
		id,
		name,
		terminalRef: terminal,
		projectDir,
		jsonlFile,
		fileOffset: initialOffset,
		lineBuffer: '',
		activeToolIds: new Set(),
		activeToolStatuses: new Map(),
		activeToolNames: new Map(),
		activeSubagentToolIds: new Map(),
		activeSubagentToolNames: new Map(),
		asyncAgentToolIds: new Set(),
		subagentWatches: new Map(),
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

	console.log(`[Pixel Agents] Agent ${id} (${name}): adopted terminal "${terminal.name}" for ${path.basename(jsonlFile)}`);
	webview?.postMessage({ type: 'agentCreated', id, name });

	startFileWatching(id, jsonlFile, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, webview);
	readNewLines(id, agents, waitingTimers, permissionTimers, webview);
}

export function reassignAgentToFile(
	agentId: number,
	newFilePath: string,
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	webview: vscode.Webview | undefined,
	persistAgents: () => void,
): void {
	const agent = agents.get(agentId);
	if (!agent) {return;}

	// Stop old file watching
	fileWatchers.get(agentId)?.close();
	fileWatchers.delete(agentId);
	const pt = pollingTimers.get(agentId);
	if (pt) { clearInterval(pt); }
	pollingTimers.delete(agentId);

	// Clear activity
	cancelWaitingTimer(agentId, waitingTimers);
	cancelPermissionTimer(agentId, permissionTimers);
	clearAgentActivity(agent, agentId, permissionTimers, webview);

	// Swap to new file
	agent.jsonlFile = newFilePath;
	agent.fileOffset = 0;
	agent.lineBuffer = '';
	agent.usage = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, model: null };
	persistAgents();

	// Start watching new file
	startFileWatching(agentId, newFilePath, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, webview);
	readNewLines(agentId, agents, waitingTimers, permissionTimers, webview);
}
