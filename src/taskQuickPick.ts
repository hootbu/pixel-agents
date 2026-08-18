import * as vscode from 'vscode';
import type { AgentState } from './types.js';
import { TASK_QUICK_PICK_REFRESH_MS } from './constants.js';
import { SUBAGENT_TOOLS } from './transcriptParser.js';

interface TaskPickItem extends vscode.QuickPickItem {
	agentId: number | null;
}

/** Tool IDs of sub-agents this agent spawned: still-running Agent/Task calls plus backgrounded ones. */
function subagentToolIds(agent: AgentState): string[] {
	const ids = [...agent.activeToolIds].filter(
		id => SUBAGENT_TOOLS.has(agent.activeToolNames.get(id) || '')
	);
	for (const id of agent.asyncAgentToolIds) {
		if (!ids.includes(id)) { ids.push(id); }
	}
	return ids;
}

/** What an agent is doing right now, mirroring the webview Tasks panel wording. */
function activityText(agent: AgentState, subIds: string[]): string {
	if (agent.permissionSent) { return 'Needs approval'; }
	// Sub-agents get their own rows, so don't repeat their Agent/Task call here.
	const statuses = [...agent.activeToolStatuses]
		.filter(([id]) => !subIds.includes(id))
		.map(([, status]) => status);
	if (statuses.length > 0) { return statuses[statuses.length - 1]; }
	if (subIds.length > 0) { return `${subIds.length} sub-agent${subIds.length > 1 ? 's' : ''} running`; }
	if (agent.isWaiting) { return 'Waiting for you'; }
	return 'Idle';
}

function statusIcon(agent: AgentState): string {
	if (agent.permissionSent) { return '$(warning)'; }
	if (agent.activeToolStatuses.size > 0) { return '$(sync~spin)'; }
	if (agent.isWaiting) { return '$(check)'; }
	return '$(circle-outline)';
}

/** Last tool a spawned sub-agent started, or a placeholder while it thinks. */
function subActivityText(agent: AgentState, parentToolId: string): string {
	const names = agent.activeSubagentToolNames.get(parentToolId);
	if (names && names.size > 0) {
		return [...names.values()][names.size - 1];
	}
	return 'Thinking...';
}

function buildItems(agents: Map<number, AgentState>): TaskPickItem[] {
	if (agents.size === 0) {
		return [{ label: '$(info) No active agents', agentId: null }];
	}

	const items: TaskPickItem[] = [];
	for (const agent of agents.values()) {
		const subIds = subagentToolIds(agent);
		items.push({
			label: `${statusIcon(agent)} ${agent.name}`,
			description: activityText(agent, subIds),
			agentId: agent.id,
		});
		for (const toolId of subIds) {
			const name = agent.subagentWatches.get(toolId)?.name
				?? agent.activeToolStatuses.get(toolId)
				?? 'Sub-agent';
			items.push({
				label: `      $(arrow-small-right) ${name}`,
				description: subActivityText(agent, toolId),
				agentId: agent.id,
			});
		}
	}
	return items;
}

/** Opens the live Tasks list. Selecting a row focuses that agent's terminal. */
export function showTaskQuickPick(agents: Map<number, AgentState>): void {
	const quickPick = vscode.window.createQuickPick<TaskPickItem>();
	quickPick.title = 'Pixel Agents — Tasks';
	quickPick.placeholder = 'Select an agent to open its terminal';

	const refresh = () => {
		const activeLabel = quickPick.activeItems[0]?.label;
		quickPick.items = buildItems(agents);
		const match = quickPick.items.find(i => i.label === activeLabel);
		if (match) { quickPick.activeItems = [match]; }
	};
	refresh();

	const timer = setInterval(refresh, TASK_QUICK_PICK_REFRESH_MS);

	quickPick.onDidAccept(() => {
		const selected = quickPick.selectedItems[0];
		if (selected && selected.agentId !== null) {
			agents.get(selected.agentId)?.terminalRef.show();
		}
		quickPick.hide();
	});
	quickPick.onDidHide(() => {
		clearInterval(timer);
		quickPick.dispose();
	});
	quickPick.show();
}
