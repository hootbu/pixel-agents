import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { AgentState } from './types.js';
import {
	launchNewTerminal,
	removeAgent,
	restoreAgents,
	persistAgents,
	sendExistingAgents,
	sendLayout,
	getProjectDirPath,
} from './agentManager.js';
import { ensureProjectScan } from './fileWatcher.js';
import { loadFurnitureAssets, sendAssetsToWebview, loadFloorTiles, sendFloorTilesToWebview, loadWallTiles, sendWallTilesToWebview, loadCharacterSprites, sendCharacterSpritesToWebview } from './assetLoader.js';

export class ArcadiaViewProvider implements vscode.WebviewViewProvider {
	nextAgentId = { current: 1 };
	nextTerminalIndex = { current: 1 };
	agents = new Map<number, AgentState>();
	webviewView: vscode.WebviewView | undefined;

	// Per-agent timers
	fileWatchers = new Map<number, fs.FSWatcher>();
	pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
	waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
	jsonlPollTimers = new Map<number, ReturnType<typeof setInterval>>();
	permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();

	// /clear detection: project-level scan for new JSONL files
	activeAgentId = { current: null as number | null };
	knownJsonlFiles = new Set<string>();
	projectScanTimer = { current: null as ReturnType<typeof setInterval> | null };

	constructor(private readonly context: vscode.ExtensionContext) {}

	private get extensionUri(): vscode.Uri {
		return this.context.extensionUri;
	}

	private get webview(): vscode.Webview | undefined {
		return this.webviewView?.webview;
	}

	private persistAgents = (): void => {
		persistAgents(this.agents, this.context);
	};

	resolveWebviewView(webviewView: vscode.WebviewView) {
		this.webviewView = webviewView;
		webviewView.webview.options = { enableScripts: true };
		webviewView.webview.html = getWebviewContent(webviewView.webview, this.extensionUri);

		webviewView.webview.onDidReceiveMessage((message) => {
			if (message.type === 'openClaude') {
				launchNewTerminal(
					this.nextAgentId, this.nextTerminalIndex,
					this.agents, this.activeAgentId, this.knownJsonlFiles,
					this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
					this.jsonlPollTimers, this.projectScanTimer,
					this.webview, this.persistAgents,
				);
			} else if (message.type === 'focusAgent') {
				const agent = this.agents.get(message.id);
				if (agent) {
					agent.terminalRef.show();
				}
			} else if (message.type === 'closeAgent') {
				const agent = this.agents.get(message.id);
				if (agent) {
					agent.terminalRef.dispose();
				}
			} else if (message.type === 'saveAgentSeats') {
				// Store seat assignments in a separate key (never touched by persistAgents)
				console.log(`[Arcadia] saveAgentSeats:`, JSON.stringify(message.seats));
				this.context.workspaceState.update('arcadia.agentSeats', message.seats);
			} else if (message.type === 'saveLayout') {
				this.context.workspaceState.update('arcadia.layout', message.layout);
			} else if (message.type === 'webviewReady') {
				restoreAgents(
					this.context,
					this.nextAgentId, this.nextTerminalIndex,
					this.agents, this.knownJsonlFiles,
					this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
					this.jsonlPollTimers, this.projectScanTimer, this.activeAgentId,
					this.webview, this.persistAgents,
				);
				// Ensure project scan runs even with no restored agents (to adopt external terminals)
				const projectDir = getProjectDirPath();
				const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
				console.log('[Extension] workspaceRoot:', workspaceRoot);
				console.log('[Extension] projectDir:', projectDir);
				if (projectDir) {
					ensureProjectScan(
						projectDir, this.knownJsonlFiles, this.projectScanTimer, this.activeAgentId,
						this.nextAgentId, this.agents,
						this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
						this.webview, this.persistAgents,
					);

					// Load furniture assets BEFORE sending layout
					(async () => {
						try {
							console.log('[Extension] Loading furniture assets...');
							const extensionPath = this.extensionUri.fsPath;
							console.log('[Extension] extensionPath:', extensionPath);

							// Check bundled location first: extensionPath/dist/assets/
							const bundledAssetsDir = path.join(extensionPath, 'dist', 'assets');
							let assetsRoot: string | null = null;
							if (fs.existsSync(bundledAssetsDir)) {
								console.log('[Extension] Found bundled assets at dist/');
								assetsRoot = path.join(extensionPath, 'dist');
							} else if (workspaceRoot) {
								// Fall back to workspace root (development or external assets)
								console.log('[Extension] Trying workspace for assets...');
								assetsRoot = workspaceRoot;
							}

							if (!assetsRoot) {
								console.log('[Extension] ⚠️  No assets directory found');
								if (this.webview) {
									sendLayout(this.context, this.webview);
								}
								return;
							}

							console.log('[Extension] Using assetsRoot:', assetsRoot);

							// Load character sprites
							const charSprites = await loadCharacterSprites(assetsRoot);
							if (charSprites && this.webview) {
								console.log('[Extension] Character sprites loaded, sending to webview');
								sendCharacterSpritesToWebview(this.webview, charSprites);
							}

							// Load floor tiles
							const floorTiles = await loadFloorTiles(assetsRoot);
							if (floorTiles && this.webview) {
								console.log('[Extension] Floor tiles loaded, sending to webview');
								sendFloorTilesToWebview(this.webview, floorTiles);
							}

							// Load wall tiles
							const wallTiles = await loadWallTiles(assetsRoot);
							if (wallTiles && this.webview) {
								console.log('[Extension] Wall tiles loaded, sending to webview');
								sendWallTilesToWebview(this.webview, wallTiles);
							}

							const assets = await loadFurnitureAssets(assetsRoot);
							if (assets && this.webview) {
								console.log('[Extension] ✅ Assets loaded, sending to webview');
								sendAssetsToWebview(this.webview, assets);
							}
						} catch (err) {
							console.error('[Extension] ❌ Error loading assets:', err);
						}
						// Always send saved layout (or null for default)
						if (this.webview) {
							console.log('[Extension] Sending saved layout');
							sendLayout(this.context, this.webview);
						}
					})();
				} else {
					// No project dir — still try to load floor/wall tiles, then send saved layout
					(async () => {
						try {
							const ep = this.extensionUri.fsPath;
							const bundled = path.join(ep, 'dist', 'assets');
							if (fs.existsSync(bundled)) {
								const distRoot = path.join(ep, 'dist');
								const cs = await loadCharacterSprites(distRoot);
								if (cs && this.webview) {
									sendCharacterSpritesToWebview(this.webview, cs);
								}
								const ft = await loadFloorTiles(distRoot);
								if (ft && this.webview) {
									sendFloorTilesToWebview(this.webview, ft);
								}
								const wt = await loadWallTiles(distRoot);
								if (wt && this.webview) {
									sendWallTilesToWebview(this.webview, wt);
								}
							}
						} catch { /* ignore */ }
						if (this.webview) {
							sendLayout(this.context, this.webview);
						}
					})();
				}
				sendExistingAgents(this.agents, this.context, this.webview);
			} else if (message.type === 'openSessionsFolder') {
				const projectDir = getProjectDirPath();
				if (projectDir && fs.existsSync(projectDir)) {
					vscode.env.openExternal(vscode.Uri.file(projectDir));
				}
			}
		});

		vscode.window.onDidChangeActiveTerminal((terminal) => {
			this.activeAgentId.current = null;
			if (!terminal) return;
			for (const [id, agent] of this.agents) {
				if (agent.terminalRef === terminal) {
					this.activeAgentId.current = id;
					webviewView.webview.postMessage({ type: 'agentSelected', id });
					break;
				}
			}
		});

		vscode.window.onDidCloseTerminal((closed) => {
			for (const [id, agent] of this.agents) {
				if (agent.terminalRef === closed) {
					if (this.activeAgentId.current === id) {
						this.activeAgentId.current = null;
					}
					removeAgent(
						id, this.agents,
						this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
						this.jsonlPollTimers, this.persistAgents,
					);
					webviewView.webview.postMessage({ type: 'agentClosed', id });
				}
			}
		});
	}

	dispose() {
		for (const id of [...this.agents.keys()]) {
			removeAgent(
				id, this.agents,
				this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers,
				this.jsonlPollTimers, this.persistAgents,
			);
		}
		if (this.projectScanTimer.current) {
			clearInterval(this.projectScanTimer.current);
			this.projectScanTimer.current = null;
		}
	}
}

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const distPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');
	const indexPath = vscode.Uri.joinPath(distPath, 'index.html').fsPath;

	let html = fs.readFileSync(indexPath, 'utf-8');

	html = html.replace(/(href|src)="\.\/([^"]+)"/g, (_match, attr, filePath) => {
		const fileUri = vscode.Uri.joinPath(distPath, filePath);
		const webviewUri = webview.asWebviewUri(fileUri);
		return `${attr}="${webviewUri}"`;
	});

	return html;
}
