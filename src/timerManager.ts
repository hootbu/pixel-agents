import type * as vscode from 'vscode';
import type { AgentState } from './types.js';
import {
	PERMISSION_TIMER_DELAY_MS,
	PERMISSION_TIMEOUT_FAST_MS,
	PERMISSION_TIMEOUT_NETWORK_MS,
	PERMISSION_TIMEOUT_SLOW_MS,
	TOOL_TIMEOUT_CATEGORY,
} from './constants.js';

export function clearAgentActivity(
	agent: AgentState | undefined,
	agentId: number,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	webview: vscode.Webview | undefined,
): void {
	if (!agent) {return;}
	agent.activeToolIds.clear();
	agent.activeToolStatuses.clear();
	agent.activeToolNames.clear();
	agent.activeSubagentToolIds.clear();
	agent.activeSubagentToolNames.clear();
	agent.earlyCompletionToolIds.clear();
	agent.isWaiting = false;
	agent.permissionSent = false;
	cancelPermissionTimer(agentId, permissionTimers);
	webview?.postMessage({ type: 'agentToolsClear', id: agentId });
	webview?.postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
}

export function cancelWaitingTimer(
	agentId: number,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
): void {
	const timer = waitingTimers.get(agentId);
	if (timer) {
		clearTimeout(timer);
		waitingTimers.delete(agentId);
	}
}

export function startWaitingTimer(
	agentId: number,
	delayMs: number,
	agents: Map<number, AgentState>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	webview: vscode.Webview | undefined,
): void {
	cancelWaitingTimer(agentId, waitingTimers);
	const timer = setTimeout(() => {
		waitingTimers.delete(agentId);
		const agent = agents.get(agentId);
		if (agent) {
			agent.isWaiting = true;
		}
		webview?.postMessage({
			type: 'agentStatus',
			id: agentId,
			status: 'waiting',
		});
	}, delayMs);
	waitingTimers.set(agentId, timer);
}

export function cancelPermissionTimer(
	agentId: number,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
): void {
	const timer = permissionTimers.get(agentId);
	if (timer) {
		clearTimeout(timer);
		permissionTimers.delete(agentId);
	}
}

export function getPermissionTimeout(
	activeToolNames: Map<string, string>,
	permissionExemptTools: Set<string>,
): number {
	let maxTimeout = PERMISSION_TIMEOUT_FAST_MS;
	for (const [, toolName] of activeToolNames) {
		if (permissionExemptTools.has(toolName)) {continue;}
		const category = TOOL_TIMEOUT_CATEGORY[toolName];
		const timeout = category === 'slow' ? PERMISSION_TIMEOUT_SLOW_MS
			: category === 'network' ? PERMISSION_TIMEOUT_NETWORK_MS
			: category === 'fast' ? PERMISSION_TIMEOUT_FAST_MS
			: PERMISSION_TIMER_DELAY_MS;
		if (timeout > maxTimeout) {maxTimeout = timeout;}
	}
	return maxTimeout;
}

export function startPermissionTimer(
	agentId: number,
	agents: Map<number, AgentState>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionExemptTools: Set<string>,
	webview: vscode.Webview | undefined,
): void {
	cancelPermissionTimer(agentId, permissionTimers);
	const currentAgent = agents.get(agentId);
	const delay = currentAgent ? getPermissionTimeout(currentAgent.activeToolNames, permissionExemptTools) : PERMISSION_TIMER_DELAY_MS;
	const timer = setTimeout(() => {
		permissionTimers.delete(agentId);
		const agent = agents.get(agentId);
		if (!agent) {return;}

		// Only flag if there are still active non-exempt tools (parent or sub-agent)
		let hasNonExempt = false;
		for (const toolId of agent.activeToolIds) {
			const toolName = agent.activeToolNames.get(toolId);
			if (!permissionExemptTools.has(toolName || '')) {
				hasNonExempt = true;
				break;
			}
		}

		// Check sub-agent tools for non-exempt tools
		const stuckSubagentParentToolIds: string[] = [];
		for (const [parentToolId, subToolNames] of agent.activeSubagentToolNames) {
			for (const [, toolName] of subToolNames) {
				if (!permissionExemptTools.has(toolName)) {
					stuckSubagentParentToolIds.push(parentToolId);
					hasNonExempt = true;
					break;
				}
			}
		}

		if (hasNonExempt) {
			agent.permissionSent = true;
			console.log(`[Pixel Agents] Agent ${agentId}: possible permission wait detected`);
			webview?.postMessage({
				type: 'agentToolPermission',
				id: agentId,
			});
			// Also notify stuck sub-agents
			for (const parentToolId of stuckSubagentParentToolIds) {
				webview?.postMessage({
					type: 'subagentToolPermission',
					id: agentId,
					parentToolId,
				});
			}
		}
	}, delay);
	permissionTimers.set(agentId, timer);
}
