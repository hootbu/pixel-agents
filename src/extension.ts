import * as vscode from 'vscode';
import { PixelAgentsViewProvider } from './PixelAgentsViewProvider.js';
import { VIEW_ID, COMMAND_SHOW_PANEL, COMMAND_EXPORT_DEFAULT_LAYOUT, COMMAND_NEW_AGENT, COMMAND_SHOW_TASKS, STATUS_BAR_PRIORITY, STATUS_BAR_TASKS_PRIORITY } from './constants.js';
import { showTaskQuickPick } from './taskQuickPick.js';

let providerInstance: PixelAgentsViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
	const provider = new PixelAgentsViewProvider(context);
	providerInstance = provider;

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(VIEW_ID, provider, {
			webviewOptions: { retainContextWhenHidden: true }
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_SHOW_PANEL, () => {
			vscode.commands.executeCommand(`${VIEW_ID}.focus`);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_EXPORT_DEFAULT_LAYOUT, () => {
			provider.exportDefaultLayout();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_NEW_AGENT, () => {
			provider.launchAgent();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_SHOW_TASKS, () => {
			showTaskQuickPick(provider.agents);
		})
	);

	const newAgentItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, STATUS_BAR_PRIORITY);
	newAgentItem.text = '$(add) Agent';
	newAgentItem.tooltip = 'Pixel Agents: New Agent';
	newAgentItem.command = COMMAND_NEW_AGENT;
	newAgentItem.show();
	context.subscriptions.push(newAgentItem);

	const tasksItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, STATUS_BAR_TASKS_PRIORITY);
	tasksItem.text = '$(checklist) Tasks';
	tasksItem.tooltip = 'Pixel Agents: Show Tasks';
	tasksItem.command = COMMAND_SHOW_TASKS;
	tasksItem.show();
	context.subscriptions.push(tasksItem);
}

export function deactivate() {
	providerInstance?.dispose();
}
