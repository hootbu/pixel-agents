import * as path from 'path';
import type * as vscode from 'vscode';
import type { AgentState } from './types.js';
import {
	cancelWaitingTimer,
	startWaitingTimer,
	clearAgentActivity,
	startPermissionTimer,
	cancelPermissionTimer,
} from './timerManager.js';
import {
	TOOL_DONE_DELAY_MS,
	TEXT_IDLE_DELAY_MS,
	BASH_COMMAND_DISPLAY_MAX_LENGTH,
	TASK_DESCRIPTION_DISPLAY_MAX_LENGTH,
	MOOD_STRESSED_TOOL_DURATION_MS,
	MOOD_STRESSED_RAPID_THRESHOLD_MS,
	MOOD_STRESSED_RAPID_COUNT,
} from './constants.js';

// Tools that spawn a sub-agent. Newer Claude Code renamed 'Task' → 'Agent';
// both are recognized so spawned agents show up as sub-agent characters.
export const SUBAGENT_TOOLS = new Set(['Task', 'Agent']);

export const PERMISSION_EXEMPT_TOOLS = new Set(['Task', 'Agent', 'AskUserQuestion']);

// A spawned Agent (async one-shot OR standby teammate) returns a launch ack
// immediately — long before it finishes — so it must NOT despawn the sub-agent.
// Both ack variants ("Async agent launched successfully" / "Spawned successfully")
// carry this internal-metadata note, which a real completion result never does.
const LAUNCH_ACK_MARKER = 'This tool result is internal metadata';

/** Flatten a tool_result's content (string | array of blocks) into plain text. */
function toolResultText(content: unknown): string {
	if (typeof content === 'string') {return content;}
	if (Array.isArray(content)) {
		return content.map(b => (b && typeof b === 'object' && typeof (b as { text?: unknown }).text === 'string' ? (b as { text: string }).text : '')).join(' ');
	}
	return '';
}

export function formatToolStatus(toolName: string, input: Record<string, unknown>): string {
	const base = (p: unknown) => typeof p === 'string' ? path.basename(p) : '';
	switch (toolName) {
		case 'Read': return `Reading ${base(input.file_path)}`;
		case 'Edit': return `Editing ${base(input.file_path)}`;
		case 'Write': return `Writing ${base(input.file_path)}`;
		case 'Bash': {
			const cmd = (input.command as string) || '';
			return `Running: ${cmd.length > BASH_COMMAND_DISPLAY_MAX_LENGTH ? cmd.slice(0, BASH_COMMAND_DISPLAY_MAX_LENGTH) + '\u2026' : cmd}`;
		}
		case 'Glob': return 'Searching files';
		case 'Grep': return 'Searching code';
		case 'WebFetch': return 'Fetching web content';
		case 'WebSearch': return 'Searching the web';
		case 'Task':
		case 'Agent': {
			const desc = typeof input.description === 'string' ? input.description : '';
			return desc ? `Subtask: ${desc.length > TASK_DESCRIPTION_DISPLAY_MAX_LENGTH ? desc.slice(0, TASK_DESCRIPTION_DISPLAY_MAX_LENGTH) + '\u2026' : desc}` : 'Running subtask';
		}
		case 'AskUserQuestion': return 'Waiting for your answer';
		case 'EnterPlanMode': return 'Planning';
		case 'NotebookEdit': return `Editing notebook`;
		default: return `Using ${toolName}`;
	}
}

export interface AchievementHooks {
	onError: () => void;
	onTurnComplete: () => void;
	onToolUse: (toolName: string, input: Record<string, unknown>) => void;
	onTokens: (agentId: number, total: number) => void;
}

export function processTranscriptLine(
	agentId: number,
	line: string,
	agents: Map<number, AgentState>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	webview: vscode.Webview | undefined,
	achievementHooks?: AchievementHooks,
): void {
	const agent = agents.get(agentId);
	if (!agent) {return;}
	try {
		const record = JSON.parse(line);

		if (record.type === 'assistant' && Array.isArray(record.message?.content)) {
			cancelWaitingTimer(agentId, waitingTimers);

			// Extract and accumulate usage data
			const usage = record.message.usage as { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number } | undefined;
			if (usage) {
				agent.usage.inputTokens += usage.input_tokens || 0;
				agent.usage.outputTokens += usage.output_tokens || 0;
				agent.usage.cacheCreationTokens += usage.cache_creation_input_tokens || 0;
				agent.usage.cacheReadTokens += usage.cache_read_input_tokens || 0;
			}
			const model = record.message.model as string | undefined;
			if (model) {
				agent.usage.model = model;
			}
			const u = agent.usage;
			const totalTokens = u.inputTokens + u.outputTokens + u.cacheCreationTokens + u.cacheReadTokens;
			webview?.postMessage({
				type: 'agentUsageUpdate',
				id: agentId,
				usage: {
					inputTokens: u.inputTokens,
					outputTokens: u.outputTokens,
					cacheCreationTokens: u.cacheCreationTokens,
					cacheReadTokens: u.cacheReadTokens,
					totalTokens,
					model: u.model,
				},
			});
			achievementHooks?.onTokens(agentId, totalTokens);

			const blocks = record.message.content as Array<{
				type: string; id?: string; name?: string; input?: Record<string, unknown>;
			}>;
			const hasToolUse = blocks.some(b => b.type === 'tool_use');

			if (hasToolUse) {
				agent.isWaiting = false;
				agent.hadToolsInTurn = true;
				webview?.postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
				let hasNonExemptTool = false;
				const now = Date.now();
				for (const block of blocks) {
					if (block.type === 'tool_use' && block.id) {
						const toolName = block.name || '';
						const status = formatToolStatus(toolName, block.input || {});
						console.log(`[Pixel Agents] Agent ${agentId} tool start: ${block.id} ${status}`);
						agent.activeToolIds.add(block.id);
						agent.activeToolStatuses.set(block.id, status);
						agent.activeToolNames.set(block.id, toolName);
						if (!PERMISSION_EXEMPT_TOOLS.has(toolName)) {
							hasNonExemptTool = true;
						}
						webview?.postMessage({
							type: 'agentToolStart',
							id: agentId,
							toolId: block.id,
							status,
						});
						achievementHooks?.onToolUse(toolName, block.input || {});
					}
				}
				// Stressed detection: rapid tool starts
				agent.recentToolStarts.push(now);
				agent.recentToolStarts = agent.recentToolStarts.filter(t => now - t < MOOD_STRESSED_RAPID_THRESHOLD_MS);
				if (agent.recentToolStarts.length >= MOOD_STRESSED_RAPID_COUNT) {
					webview?.postMessage({ type: 'agentMoodEvent', id: agentId, mood: 'stressed' });
					agent.recentToolStarts = [];
				}
				// Stressed detection: long-running tool
				if (agent.lastToolStartTime > 0 && (now - agent.lastToolStartTime) > MOOD_STRESSED_TOOL_DURATION_MS) {
					webview?.postMessage({ type: 'agentMoodEvent', id: agentId, mood: 'stressed' });
				}
				agent.lastToolStartTime = now;
				if (hasNonExemptTool) {
					startPermissionTimer(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, webview);
				}
			} else if (blocks.some(b => b.type === 'text') && !agent.hadToolsInTurn) {
				// Text-only response in a turn that hasn't used any tools.
				// turn_duration handles tool-using turns reliably but is never
				// emitted for text-only turns, so we use a silence-based timer:
				// if no new JSONL data arrives within TEXT_IDLE_DELAY_MS, mark as waiting.
				startWaitingTimer(agentId, TEXT_IDLE_DELAY_MS, agents, waitingTimers, webview);
			}
		} else if (record.type === 'progress') {
			processProgressRecord(agentId, record, agents, waitingTimers, permissionTimers, webview);
		} else if (record.type === 'user') {
			const content = record.message?.content;
			if (Array.isArray(content)) {
				const blocks = content as Array<{ type: string; tool_use_id?: string; is_error?: boolean; content?: unknown }>;
				const hasToolResult = blocks.some(b => b.type === 'tool_result');
				if (hasToolResult) {
					for (const block of blocks) {
						// Error mood detection
						if (block.type === 'tool_result' && block.is_error) {
							agent.errorCountInTurn++;
							webview?.postMessage({ type: 'agentMoodEvent', id: agentId, mood: 'error' });
							achievementHooks?.onError();
						}
						if (block.type === 'tool_result' && block.tool_use_id) {
							console.log(`[Pixel Agents] Agent ${agentId} tool done: ${block.tool_use_id}`);
							const completedToolId = block.tool_use_id;
							const isSubagentTool = SUBAGENT_TOOLS.has(agent.activeToolNames.get(completedToolId) || '');
							const resultText = toolResultText(block.content);
							if (isSubagentTool && resultText.includes(LAUNCH_ACK_MARKER)) {
								// Spawned agent just launched — this is only the ack. Keep its
								// character alive; it despawns on its <task-notification> (one-shot)
								// or when the parent agent closes (persistent teammate).
								agent.asyncAgentToolIds.add(completedToolId);
								// Teammate acks carry "agent_id: <Name>@session-…" — show that name
								// on the character instead of the raw task description.
								const nameMatch = resultText.match(/agent_id:\s*([^\s@]+)@/);
								if (nameMatch) {
									webview?.postMessage({
										type: 'subagentName',
										id: agentId,
										parentToolId: completedToolId,
										name: nameMatch[1],
									});
								}
							} else if (isSubagentTool) {
								// Synchronous sub-agent finished → clear its subagent tools
								agent.activeSubagentToolIds.delete(completedToolId);
								agent.activeSubagentToolNames.delete(completedToolId);
								webview?.postMessage({
									type: 'subagentClear',
									id: agentId,
									parentToolId: completedToolId,
								});
							}
							const delay = agent.earlyCompletionToolIds.has(completedToolId) ? 0 : TOOL_DONE_DELAY_MS;
							agent.earlyCompletionToolIds.delete(completedToolId);
							agent.activeToolIds.delete(completedToolId);
							agent.activeToolStatuses.delete(completedToolId);
							agent.activeToolNames.delete(completedToolId);
							const toolId = completedToolId;
							setTimeout(() => {
								webview?.postMessage({
									type: 'agentToolDone',
									id: agentId,
									toolId,
								});
							}, delay);
						}
					}
					// All tools completed — start fallback waiting timer
					// in case turn_duration is not emitted
					if (agent.activeToolIds.size === 0) {
						agent.hadToolsInTurn = false;
						startWaitingTimer(agentId, TEXT_IDLE_DELAY_MS, agents, waitingTimers, webview);
					}
				} else {
					// New user text prompt — new turn starting
					cancelWaitingTimer(agentId, waitingTimers);
					clearAgentActivity(agent, agentId, permissionTimers, webview);
					agent.hadToolsInTurn = false;
					agent.errorCountInTurn = 0;
					agent.recentToolStarts = [];
				}
			} else if (typeof content === 'string' && content.trim()) {
				// New user text prompt — new turn starting
				cancelWaitingTimer(agentId, waitingTimers);
				clearAgentActivity(agent, agentId, permissionTimers, webview);
				agent.hadToolsInTurn = false;
				agent.errorCountInTurn = 0;
				agent.recentToolStarts = [];
			}
		} else if (record.type === 'system' && record.subtype === 'turn_duration') {
			cancelWaitingTimer(agentId, waitingTimers);
			cancelPermissionTimer(agentId, permissionTimers);

			// Definitive turn-end: clean up any stale tool state
			if (agent.activeToolIds.size > 0) {
				agent.activeToolIds.clear();
				agent.activeToolStatuses.clear();
				agent.activeToolNames.clear();
				agent.activeSubagentToolIds.clear();
				agent.activeSubagentToolNames.clear();
				webview?.postMessage({ type: 'agentToolsClear', id: agentId });
			}

			// Happy mood: only for tool-using turns without errors
			if (agent.hadToolsInTurn && agent.errorCountInTurn === 0) {
				webview?.postMessage({ type: 'agentMoodEvent', id: agentId, mood: 'happy' });
			}
			achievementHooks?.onTurnComplete();

			agent.isWaiting = true;
			agent.permissionSent = false;
			agent.hadToolsInTurn = false;
			agent.lastToolStartTime = 0;
			agent.recentToolStarts = [];
			agent.errorCountInTurn = 0;
			webview?.postMessage({
				type: 'agentStatus',
				id: agentId,
				status: 'waiting',
			});
		} else if (record.type === 'queue-operation' && typeof record.content === 'string') {
			// A background (async) Agent stopped/finished. Its <task-notification>
			// carries the original tool-use-id → despawn that sub-agent character.
			const match = record.content.match(/<tool-use-id>([^<]+)<\/tool-use-id>/);
			if (match && agent.asyncAgentToolIds.has(match[1])) {
				const toolId = match[1];
				agent.asyncAgentToolIds.delete(toolId);
				agent.activeSubagentToolIds.delete(toolId);
				agent.activeSubagentToolNames.delete(toolId);
				webview?.postMessage({ type: 'subagentClear', id: agentId, parentToolId: toolId });
			}
		}
	} catch {
		// Ignore malformed lines
	}
}

function processProgressRecord(
	agentId: number,
	record: Record<string, unknown>,
	agents: Map<number, AgentState>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	webview: vscode.Webview | undefined,
): void {
	const agent = agents.get(agentId);
	if (!agent) {return;}

	const parentToolId = record.parentToolUseID as string | undefined;
	if (!parentToolId) {return;}

	const data = record.data as Record<string, unknown> | undefined;
	if (!data) {return;}

	const dataType = data.type as string | undefined;

	// hook_progress PostToolUse: tool has finished (hook ran after tool completed)
	if (dataType === 'hook_progress') {
		const hookEvent = (data as Record<string, unknown>).hookEvent as string | undefined;
		if (hookEvent === 'PostToolUse' && parentToolId && agent.activeToolIds.has(parentToolId)) {
			agent.earlyCompletionToolIds.add(parentToolId);
			cancelPermissionTimer(agentId, permissionTimers);
		}
		return;
	}

	// bash_progress: tool is actively executing, restart permission timer
	if (dataType === 'bash_progress') {
		if (agent.activeToolIds.has(parentToolId)) {
			startPermissionTimer(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, webview);
		}
		return;
	}

	// mcp_progress: check status field for early completion signals
	if (dataType === 'mcp_progress') {
		const status = (data as Record<string, unknown>).status as string | undefined;
		if (status === 'completed' || status === 'error') {
			agent.earlyCompletionToolIds.add(parentToolId);
			// Cancel permission timer if all active non-exempt tools are handled
			const allHandled = [...agent.activeToolIds].every(
				id => agent.earlyCompletionToolIds.has(id) || PERMISSION_EXEMPT_TOOLS.has(agent.activeToolNames.get(id) || '')
			);
			if (allHandled) {
				cancelPermissionTimer(agentId, permissionTimers);
			}
		} else {
			// status: "started" or other — tool is running, restart permission timer
			if (agent.activeToolIds.has(parentToolId)) {
				startPermissionTimer(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, webview);
			}
		}
		return;
	}

	// Verify parent is an active sub-agent tool (agent_progress handling)
	if (!SUBAGENT_TOOLS.has(agent.activeToolNames.get(parentToolId) || '')) {return;}

	const msg = data.message as Record<string, unknown> | undefined;
	if (!msg) {return;}

	const msgType = msg.type as string;
	const innerMsg = msg.message as Record<string, unknown> | undefined;
	const content = innerMsg?.content;
	if (!Array.isArray(content)) {return;}

	if (msgType === 'assistant') {
		let hasNonExemptSubTool = false;
		for (const block of content) {
			if (block.type === 'tool_use' && block.id) {
				const toolName = block.name || '';
				const status = formatToolStatus(toolName, block.input || {});
				console.log(`[Pixel Agents] Agent ${agentId} subagent tool start: ${block.id} ${status} (parent: ${parentToolId})`);

				// Track sub-tool IDs
				let subTools = agent.activeSubagentToolIds.get(parentToolId);
				if (!subTools) {
					subTools = new Set();
					agent.activeSubagentToolIds.set(parentToolId, subTools);
				}
				subTools.add(block.id);

				// Track sub-tool names (for permission checking)
				let subNames = agent.activeSubagentToolNames.get(parentToolId);
				if (!subNames) {
					subNames = new Map();
					agent.activeSubagentToolNames.set(parentToolId, subNames);
				}
				subNames.set(block.id, toolName);

				if (!PERMISSION_EXEMPT_TOOLS.has(toolName)) {
					hasNonExemptSubTool = true;
				}

				webview?.postMessage({
					type: 'subagentToolStart',
					id: agentId,
					parentToolId,
					toolId: block.id,
					status,
				});
			}
		}
		if (hasNonExemptSubTool) {
			startPermissionTimer(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, webview);
		}
	} else if (msgType === 'user') {
		for (const block of content) {
			if (block.type === 'tool_result' && block.tool_use_id) {
				console.log(`[Pixel Agents] Agent ${agentId} subagent tool done: ${block.tool_use_id} (parent: ${parentToolId})`);

				// Remove from tracking
				const subTools = agent.activeSubagentToolIds.get(parentToolId);
				if (subTools) {
					subTools.delete(block.tool_use_id);
				}
				const subNames = agent.activeSubagentToolNames.get(parentToolId);
				if (subNames) {
					subNames.delete(block.tool_use_id);
				}

				const toolId = block.tool_use_id;
				setTimeout(() => {
					webview?.postMessage({
						type: 'subagentToolDone',
						id: agentId,
						parentToolId,
						toolId,
					});
				}, 300);
			}
		}
		// If there are still active non-exempt sub-agent tools, restart the permission timer
		// (handles the case where one sub-agent completes but another is still stuck)
		let stillHasNonExempt = false;
		for (const [, subNames] of agent.activeSubagentToolNames) {
			for (const [, toolName] of subNames) {
				if (!PERMISSION_EXEMPT_TOOLS.has(toolName)) {
					stillHasNonExempt = true;
					break;
				}
			}
			if (stillHasNonExempt) {break;}
		}
		if (stillHasNonExempt) {
			startPermissionTimer(agentId, agents, permissionTimers, PERMISSION_EXEMPT_TOOLS, webview);
		}
	}
}
