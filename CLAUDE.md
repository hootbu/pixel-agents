# Arcadia

VS Code extension with an embedded React webview panel.

## Architecture

```
├── src/                      — Extension backend (Node.js, VS Code API)
│   ├── extension.ts          — Entry point: activate(), deactivate()
│   ├── ArcadiaViewProvider.ts — WebviewViewProvider class, message dispatch, dispose
│   ├── agentManager.ts       — Terminal lifecycle: launch, remove, restore, persist, send
│   ├── fileWatcher.ts        — File I/O: fs.watch, polling, readNewLines, /clear detection
│   ├── transcriptParser.ts   — JSONL parsing: tool_use/tool_result → webview messages
│   ├── timerManager.ts       — Waiting/permission timer logic (debounce, detection)
│   └── types.ts              — Shared interfaces (AgentState, PersistedAgent)
├── webview-ui/               — Standalone React + TypeScript app (Vite)
│   ├── src/
│   │   ├── App.tsx           — Composition root (~105 lines), hooks + components
│   │   ├── vscodeApi.ts      — acquireVsCodeApi() singleton
│   │   ├── main.tsx          — React entry point
│   │   ├── hooks/
│   │   │   ├── useExtensionMessages.ts — Message handler + agent/tool state
│   │   │   ├── useEditorActions.ts     — Editor state + all editor callbacks
│   │   │   └── useEditorKeyboard.ts    — Keyboard shortcut effect
│   │   ├── components/
│   │   │   ├── FloatingButtons.tsx     — Top-left button bar + zoom controls
│   │   │   ├── AgentLabels.tsx         — Name labels + status dots above characters
│   │   │   └── DebugView.tsx           — Card-based debug overlay showing agent tool status
│   │   └── office/           — Pixel art office UI (see "Office UI" section below)
│   └── vite.config.ts        — Builds to ../dist/webview with relative base paths
├── scripts/
│   └── export-sprites.ts     — Exports all pixel art sprites to PNG files (furniture + character sheets)
├── esbuild.js                — Bundles the extension (src/) → dist/extension.js
├── dist/                     — Build output (gitignored)
│   ├── extension.js          — Bundled extension
│   └── webview/              — Built React app (loaded by extension at runtime)
└── package.json              — VS Code manifest + all build scripts
```

## Vocabulary

- **Terminal**: The actual VS Code terminal window running Claude Code. A terminal is a physical resource — it exists as long as the VS Code terminal tab is open.
- **Session**: A single Claude Code conversation, identified by a JSONL file (`<session-id>.jsonl`). Sessions are permanent and immutable — once created, a session's identity never changes.
- **Agent**: A UI element in the Arcadia webview, permanently bound to exactly one terminal. One agent per terminal, created immediately when the terminal is launched. Clicking the agent focuses its terminal. When the terminal closes, the agent is removed.

## How it works

- The extension registers a `WebviewViewProvider` for the view `arcadia.panelView`, which lives in the bottom panel (next to Terminal).
- On resolve, it reads `dist/webview/index.html` and rewrites `./` asset paths to `webview.asWebviewUri()` URIs.
- The command `arcadia.showPanel` focuses the panel.
- **One-agent-per-terminal model**: Each "Open Claude Code" click creates a terminal and immediately creates an agent bound to it. The agent button appears right away (before the JSONL file exists). A background 1s poll waits for the specific `<uuid>.jsonl` file, then starts file watching. No adopted terminals.
- **`/clear` detection**: The extension tracks all known JSONL files in the project directory. When a new unknown file appears, it is assigned to the currently-active agent (the one whose terminal is focused). This works because `/clear` is typed in the focused terminal, and the new JSONL file it creates is the only "unknown" file. The agent's file watching is swapped to the new file and activity is cleared.
- **Terminal ↔ agent selection sync**: `onDidChangeActiveTerminal` tracks which agent is active and sends `agentSelected` to the webview so the UI highlights the matching agent when the user switches terminal tabs.
- The webview communicates with the extension via `postMessage`. Clicking "Open Claude Code" sends `openClaude`, the extension creates a named terminal running `claude --session-id <uuid>` and immediately sends `agentCreated`. Each agent gets an "Agent #n" button; clicking it sends `focusAgent` to show the hosting terminal. Each agent button has a close (✕) button that sends `closeAgent` to dispose of the terminal. Closing a terminal (manually or via the close button) sends `agentClosed` to remove its button.
- The webview sends `webviewReady` on mount; the extension responds with `existingAgents` containing all tracked agent IDs.

## Build

```sh
npm install                   # root deps
cd webview-ui && npm install  # webview deps
cd .. && npm run build        # builds both extension + webview
```

`npm run build` runs: type-check → lint → esbuild (extension) → vite build (webview).

## Dev

Press F5 to launch the Extension Development Host. The "Arcadia" tab appears in the bottom panel. Run "Arcadia: Show Panel" from the command palette to focus it.

## Key decisions

- Used `WebviewViewProvider` (not `WebviewPanel`) so the view sits in the panel area alongside the terminal rather than in an editor tab.
- Inline esbuild problem matcher in `.vscode/tasks.json` to avoid requiring the `connor4312.esbuild-problem-matchers` extension.
- Webview is a separate Vite project with its own `node_modules` and `tsconfig`. Root `tsconfig.json` excludes `webview-ui/`.

## Agent Status Tracking

Real-time display of what each Claude Code agent is doing (e.g., "Reading App.tsx", "Running: npm test").

### How it works

1. **Transcript JSONL**: Claude Code writes real-time JSONL transcripts to `~/.claude/projects/<project-hash>/<session-id>.jsonl`. The project hash is the workspace path with `:` `\` `/` replaced by `-` (e.g., `C:\Users\Developer\Desktop\Arcadia` → `C--Users-Developer-Desktop-Arcadia`).
2. **`--session-id` for deterministic file matching**: Extension generates a UUID per terminal and passes `claude --session-id <uuid>`. The JSONL file is then `<uuid>.jsonl` — no race conditions with parallel agents.
3. **Immediate agent creation**: Agent is created as soon as the terminal is launched (before the JSONL file exists). A 1s poll waits for the specific `<uuid>.jsonl` file to appear, then starts file watching.
3b. **`/clear` reassignment**: A project-level 1s scan watches for unknown JSONL files. Known files are seeded on first scan + pre-registered for each `--session-id`. When an unknown file appears and an agent's terminal is focused, that agent is reassigned to the new file (old watching stops, activity clears, new watching starts).
4. **File watching**: Once the JSONL file is found, extension watches it using hybrid `fs.watch` (instant) + 2s polling (backup). Includes partial line buffering to handle mid-write reads.
5. **Parsing**: Each JSONL line is a complete record with a top-level `type` field:
   - `"assistant"` records contain `message.content[]` with `tool_use` blocks (`id`, `name`, `input`)
   - `"user"` records contain `message.content[]` with `tool_result` blocks, OR `content` as a string (text prompt)
   - `"system"` records with `subtype: "turn_duration"` mark turn completion (reliable signal)
   - `"progress"` records contain sub-agent activity (ignored for now)
   - `"file-history-snapshot"` records track file state (ignored)
   - `"assistant"` records can also have `content: [{type: "thinking"}]` — reasoning blocks, not text
   - Tool IDs match 1:1 between `tool_use.id` and `tool_result.tool_use_id`
6. **Messages to webview**:
   - `agentCreated { id }` — when a terminal is created and agent is bound to it
   - `agentClosed { id }` — when terminal closes
   - `openSessionsFolder` — opens the JSONL project directory in file explorer
   - `agentToolStart { id, toolId, status }` — when a tool_use block is found
   - `agentToolDone { id, toolId }` — when a matching tool_result block is found (300ms delayed)
   - `agentToolsClear { id }` — when a new user prompt is detected (clears stacked tools)
   - `agentStatus { id, status: 'waiting' | 'active' }` — when agent finishes turn or starts new work
   - `existingAgents { agents: number[], agentMeta }` — sent on webview reconnect, includes palette/seatId per agent
7. **Webview rendering**: Top-down pixel art office scene (Gather.town style). Each agent is an animated character at a desk. Tool status appears as hover tooltips over characters. "+" Agent and "Sessions" buttons float in the top-left corner. See "Office UI" section for full details.

### Key lessons learned

- **Previous failed approach**: Hook-based file IPC. Hooks are captured at session startup, terminal env vars don't propagate to hook subprocesses. Transcript watching is much simpler.
- **`fs.watch` is unreliable on Windows**: Sometimes misses events. Always pair with polling as a backup.
- **Partial line buffering is essential**: When reading an append-only file, the last line may be incomplete (mid-write). Only process lines terminated by `\n`; carry the remainder to the next read.
- **Flickering / instant completion**: For fast tools (~1s like Read), `tool_use` and `tool_result` arrive in the same `readNewLines` batch. Without a delay, React batches both state updates into a single render and the user never sees the blue active state. Fixed by delaying `agentToolDone` messages by 300ms.
- **`--session-id` for multi-agent**: Each terminal gets `claude --session-id <uuid>` so the JSONL filename is deterministic (`<uuid>.jsonl`). Eliminates race conditions when parallel agents share the same project directory.
- **User prompts can be string or array**: `record.message.content` is a string for text prompts, an array for tool results. Must handle both forms to properly clear tools/status on new prompts.
- **`/clear` creates a new JSONL file**: The `/clear` command is recorded in the NEW file's first records, not the old file. The old file simply stops receiving writes.
- **`--output-format stream-json` requires non-TTY stdin**: Cannot be used with VS Code terminals (Ink TUI requires TTY). Transcript JSONL watching is the alternative.
- **Text-only assistant records are often intermediate**: In the JSONL, text and tool_use from the same API response are written as separate records. A text-only `assistant` record is frequently followed by a `tool_use` record (not a turn end). The reliable turn-end signal is `system` records with `subtype: "turn_duration"`. Text-only assistant records use a 2s debounce timer as a fallback.
- **No `summary`/`result` record types exist**: Turn completion is signaled by `system` records with `subtype: "turn_duration"`, not `summary` or `result`.

### Extension state

**Consolidated `AgentState` struct** (per agent):
```
id, terminalRef, projectDir, jsonlFile, fileOffset, lineBuffer,
activeToolIds, activeToolStatuses, isWaiting
```

**Provider-level state**:
```
agents               — agentId → AgentState (consolidated agent state)
activeAgentId        — which agent's terminal is currently focused (null if none)
knownJsonlFiles      — Set<string> of all JSONL paths seen (seeded on first scan + pre-registered per --session-id)
projectScanTimer     — setInterval (1s project-level scan for /clear detection)
jsonlPollTimers      — agentId → setInterval (1s poll for JSONL file to appear)
fileWatchers         — agentId → fs.FSWatcher
pollingTimers        — agentId → setInterval (2s backup file polling)
waitingTimers        — agentId → setTimeout (2s debounce for "waiting" status)
```

**Persistence**: Agent-to-terminal mappings are persisted to `workspaceState` (key `'arcadia.agents'`) as `PersistedAgent[]` (includes `palette?` and `seatId?` for position restore). Office layout is persisted to `workspaceState` (key `'arcadia.layout'`). On webview ready, `restoreAgents()` reads persisted state, matches each entry to a live terminal by name, and recreates the `AgentState`. `sendExistingAgents()` includes `agentMeta` with palette/seatId so characters restore to their assigned seats. `rebuildFromLayout()` preserves existing seat assignments when possible (first pass keeps valid seats, second pass assigns remaining to free seats). The webview sends `saveAgentSeats` back to the extension whenever agents are created, seats reassigned, or layout rebuilt. File watching resumes from end-of-file (no replay). Entries whose terminals no longer exist are pruned. `nextAgentId` and `nextTerminalIndex` are advanced past restored values to avoid collisions. `sendLayout()` sends the persisted layout (or null for default) to the webview.

## Office UI (Pixel Art Scene)

The webview renders a top-down pixel art office (Gather.town style) instead of a flat card list. Each AI agent is an animated character that sits at a desk when working and wanders when idle. The existing extension message protocol drives character behavior.

### File structure

All files live under `webview-ui/src/office/`, organized into subdirectories by responsibility:

```
office/
  types.ts              — Constants (TILE_SIZE=16, MAP 20x11), interfaces, FurnitureType, EditTool, OfficeLayout, ToolActivity
  toolUtils.ts          — STATUS_TO_TOOL mapping, extractToolName(), defaultZoom()

  sprites/              — Pixel art data + caching (pure data, no game logic)
    spriteData.ts       — Hardcoded pixel data for characters (6 palettes), furniture, tiles
    spriteCache.ts      — Renders SpriteData → offscreen canvas, per-zoom WeakMap cache; getOutlineSprite() for selection glow
    index.ts            — Barrel re-exports

  editor/               — Layout editing tools, state, and UI
    editorActions.ts    — Pure layout manipulation: paintTile, placeFurniture, removeFurniture, moveFurniture, canPlaceFurniture
    editorState.ts      — Imperative editor state class (tools, ghost preview, selection, undo stack)
    EditorToolbar.tsx   — React toolbar/palette component for edit mode
    index.ts            — Barrel re-exports

  layout/               — Layout data model, serialization, spatial queries, pathfinding
    furnitureCatalog.ts — FurnitureType → sprite/footprint/isDesk catalog + getCatalogEntry()
    layoutSerializer.ts — OfficeLayout ↔ runtime conversion (tileMap, furniture instances, seats, blocked tiles)
    tileMap.ts          — Walkability checks, pathfinding (BFS)
    index.ts            — Barrel re-exports

  engine/               — Character state machine, game world, game loop, rendering
    characters.ts       — Character state machine: idle/walk/type + wander AI (handles seatId=null)
    officeState.ts      — Central game world: layout-aware construction, rebuildFromLayout(), character lifecycle, agent selection + seat reassignment
    gameLoop.ts         — requestAnimationFrame loop with delta time (capped at 0.1s)
    renderer.ts         — Canvas drawing: tiles, z-sorted furniture + characters, selection outline + seat indicators, edit overlays
    index.ts            — Barrel re-exports

  components/           — React components that render the office
    OfficeCanvas.tsx    — Canvas ref, ResizeObserver, DPR, mouse hit-testing, agent selection/deselection, seat click reassignment, edit mode interactions
    ToolOverlay.tsx     — HTML tooltip positioned over hovered character showing tool status
    index.ts            — Barrel re-exports
```

### How rendering works

**Game state outside React**: An `OfficeState` class (created lazily on `layoutLoaded`, stored in `officeStateRef`) holds the `OfficeLayout`, derived tile map, furniture instances, seats, character state, and `selectedAgentId`. It's updated imperatively by message handlers and read by the canvas every frame. React state is only used for HTML overlays (tool tooltips, editor toolbar). This avoids re-renders in the hot path.

**Pixel-perfect rendering**: All rendering is done directly in device pixels — no `ctx.scale(dpr)` transform. The `zoom` level is an integer (device pixels per sprite pixel), ensuring every sprite pixel maps to exactly NxN device pixels with no fractional coordinates. Default zoom = `Math.round(2 * devicePixelRatio)`. Users can zoom in/out via Ctrl+mousewheel or +/- buttons (range 1x–10x). The sprite cache (`spriteCache.ts`) stores per-zoom WeakMaps so different zoom levels (e.g., toolbar thumbnails at 2x vs canvas at dynamic zoom) don't thrash each other.

**Pan**: Middle-mouse-button drag pans the viewport. Pan offset is stored as a `panRef` (device pixels) shared between `OfficeCanvas` and `AgentLabels`. Updated imperatively during drag (no React re-renders). The render loop and AgentLabels both read `panRef.current` each frame, so the canvas and HTML labels stay in sync.

**Sprite system**: Pixel data stored as 2D arrays of hex color strings (`SpriteData`). Rendered to offscreen canvases at the current zoom level and cached via per-zoom `WeakMap`s. Characters use palette templates (`'skin'`, `'shirt'`, etc.) resolved at creation time into concrete hex colors. 6 distinct color palettes for agents.

**Z-ordering**: All entities (furniture + characters) merged into a single array, sorted by Y-position before drawing. Lower on screen = drawn later = appears in front.

**Canvas sizing**: Panel is typically 200-400px tall. Canvas backing store = CSS size × DPR. Map is 20 cols × 11 rows × TILE_SIZE × zoom device pixels. Centered in the canvas viewport. ResizeObserver tracks container size. Character draw coordinates are `Math.round()`'d to integer device pixels for crisp rendering.

### Data flow

```
Extension messages → useExtensionMessages hook → officeState.method() + React setState()
                                                        ↓
                                              requestAnimationFrame loop
                                                        ↓
                                              officeState.update(dt) → character movement
                                                        ↓
                                              renderer draws to canvas (reads officeState)

React state (agentTools etc.) → ToolOverlay component (HTML positioned over canvas)
                              → AgentLabels component (name + status dot above each character)

Editor actions → useEditorActions hook → editorState mutations + officeState.rebuildFromLayout()
Keyboard       → useEditorKeyboard hook → delegates to useEditorActions callbacks
```

### Character behavior

- **Active (working)**: Character pathfinds (BFS) to assigned chair tile, sits down facing the desk, plays typing or reading animation depending on the active tool. Triggered by `agentToolStart` or `agentStatus: 'active'`.
- **Idle (waiting)**: Character sits briefly at desk (3-5s via `seatTimer`), then stands up and wanders to random walkable tiles via BFS pathfinding with 2-5s pauses between moves. Periodically returns to seat to sit briefly before wandering again. Triggered by `agentStatus: 'waiting'`. Walk animation has 4 frames per direction.
- **Created**: Spawns at desk in typing state (assumes new agents are immediately active).
- **Removed**: Character disappears, seat freed for next agent.

### Speech bubbles

Pixel art speech bubbles appear above agents to indicate status:

- **Permission bubble ("...")**: White square bubble with 3 amber dots. Shown when `agentToolPermission` fires. Stays until:
  - Agent is clicked (instant dismiss)
  - `agentToolPermissionClear` fires
  - New tool starts or tools cleared
- **Waiting bubble (checkmark)**: White square bubble with green checkmark. Shown when `agentStatus: 'waiting'` fires. Auto-fades after 2s (1.5s full opacity + 0.5s fade). Immediately starts fading when agent is clicked.

**Implementation**: Bubble state (`bubbleType`, `bubbleTimer`) lives on the `Character` struct. `OfficeState.update()` ticks waiting timers. `renderBubbles()` draws sprites above characters after the z-sorted scene (always on top). Sprites defined in `spriteData.ts` (`BUBBLE_PERMISSION_SPRITE`, `BUBBLE_WAITING_SPRITE`), 11x13 pixels each.

### Movement system

**Tile-based**: Characters move on a grid, one tile at a time in cardinal directions (no diagonals). BFS pathfinding navigates around walls, desks, and through doorways. Each step lerps pixel position from one tile center to the next.

**4-directional sprites**: All states (idle, walk, typing, reading) have sprites for all 4 directions (down, up, left, right). Left sprites are generated by flipping right sprites horizontally. Direction is set by the current path step when walking, and by the seat's `facingDir` when sitting.

**Tool-specific animations**: At desk, characters show either:
- **Typing** animation (arms on keyboard): Write, Edit, Bash, NotebookEdit, Task, and unknown tools
- **Reading** animation (arms at sides, looking at screen): Read, Grep, Glob, WebFetch, WebSearch

Tool name is extracted from the status prefix (e.g., "Reading src/App.tsx" → Read tool → reading animation).

### Office layout

Two rooms connected by a doorway (col 10, rows 4-6):
- **Left room** (tile floor, checkerboard pattern): 1 square desk (2x2 tiles) at (4,3)-(5,4), bookshelf on wall, plant in corner
- **Right room** (wood floor): 1 square desk (2x2 tiles) at (13,3)-(14,4), water cooler, plant, whiteboard on wall
- **Break area** (purple carpet): bottom-right corner of right room
- Walls around perimeter + center divider

### Seat system

Seats are derived from **chair furniture** placed adjacent to desks. `layoutToSeats()` scans all furniture with `category: 'chairs'`, checks cardinal neighbors for desk tiles, and generates a `Seat` with the correct `facingDir` (toward the adjacent desk). Each `Seat` is keyed by the chair furniture's `uid` in a `Map<string, Seat>`.

The default layout has 2 desks (2x2 tiles each) with 4 chairs around each = 8 seats total (6 palettes cycle). Users can add/remove chairs in the layout editor to change available seats.

**Seat fields**: `uid` (chair furniture uid), `seatCol`, `seatRow` (tile where agent sits), `facingDir` (toward desk), `assigned` (boolean).

**Agent selection + seat reassignment**: Click a character to select it (white pixel-perfect outline glow). Seat indicators appear: blue overlay on current seat, green pulsing overlay on available (unassigned) seats. Click an available seat to reassign the agent — they pathfind to their new seat immediately. Click the agent's own seat to send them back to it. Click empty space or the same agent again to deselect. Selection clears automatically when an agent is removed.

### Office Layout Editor

Toggle-based edit mode for customizing the office layout:

- **"Edit" button** (top-left, next to + Agent and Sessions) toggles edit mode on/off
- **Tools**: Select, Paint, Place, Erase, Undo, Reset
- **Paint tool**: Click/drag to paint floor tiles (Wall, Tile Floor, Wood Floor, Carpet, Doorway)
- **Place tool**: Click to place furniture from catalog (Desk, Bookshelf, Plant, Cooler, Whiteboard, Chair, PC, Lamp). Ghost preview shows placement validity (green/red tint).
- **Select tool**: Click furniture to select it (dashed blue border). Press Delete to remove.
- **Eraser tool**: Click to remove furniture at cursor position
- **Undo** (Ctrl+Z): Reverts last edit (50-level stack)
- **Reset**: Returns to default hardcoded office layout

**Layout data model**: `OfficeLayout` = `{ version: 1, cols, rows, tiles: TileType[], furniture: PlacedFurniture[] }`. Flat tile array (row-major). Each `PlacedFurniture` has `uid`, `type`, `col`, `row`.

**Persistence**: Layout saved to `workspaceState` key `'arcadia.layout'` via debounced (500ms) `saveLayout` message. On `webviewReady`, extension sends `layoutLoaded { layout }` to webview. `OfficeState.rebuildFromLayout()` rebuilds all derived state (tileMap, furniture instances, seats, blocked tiles, walkable tiles) and reassigns characters to available seats.

**No-seat behavior**: When all seats are taken or no chairs exist, agents get `seatId = null` and type in place (no pathfinding to desk). When idle, they wander normally.

**Furniture catalog**: `layout/furnitureCatalog.ts` maps each `FurnitureType` to sprite, footprint size, `isDesk` flag, and `category`. `layout/layoutSerializer.ts` generates seats dynamically from chair furniture adjacent to desks.

**Edit mode rendering**: Grid overlay (subtle white lines), ghost preview (semi-transparent sprite with green/red validity tint), selection highlight (dashed blue border). Characters keep animating during editing.

### Interaction

- **Hover** character → `ToolOverlay` tooltip appears showing agent name, active tools (blue pulsing dot), completed tools (green dot, dimmed), permission waits (amber), subagent tools (nested)
- **Click** character → toggles selection (white outline glow + seat indicators) AND sends `focusAgent` to focus terminal. Click same agent again to deselect. Click empty space to deselect.
- **Click available seat** (while agent selected) → reassigns agent to that seat, agent walks there, selection clears
- **Name labels** float above each character with status dot (blue pulse = active, amber = waiting)
- **"+ Agent" button** (top-left) creates new terminal + character
- **"Sessions" button** opens JSONL folder in file explorer
- **"Edit" button** (top-left) toggles layout editor mode
- **"Debug" button** (top-left) toggles debug overlay — card-based view showing each agent's tool activity (active/done/permission dots, subagent nesting, waiting status). Toolbar stays visible on top (z-index 50 > debug z-index 40).
- **Zoom** +/- buttons (top-left) or Ctrl+mousewheel to change integer zoom level (1x–10x)
- **Pan** middle-mouse-button drag to pan the viewport when zoomed in

### TypeScript constraints

- No `enum` (`erasableSyntaxOnly`) — use `as const` objects (e.g., `TileType`, `CharacterState`, `Direction`)
- `import type` required for type-only imports (`verbatimModuleSyntax`)
- `noUnusedLocals` / `noUnusedParameters` — every import must be used

## Memory

Keep all memories and notes in this file (CLAUDE.md), not in `~/.claude/` memory files.

### Key patterns
- `crypto.randomUUID()` works in VS Code extension host
- Terminal `cwd` option sets working directory at creation; `!cd` does NOT work mid-session
- `/add-dir <path>` grants a running session access to an additional directory
- To change cwd, must close session and restart with new `cwd` terminal option

### Windows-MCP (desktop automation)
- Installed as user-scoped MCP server via `uvx --python 3.13 windows-mcp`
- Tools: `Snapshot`, `Click`, `Type`, `Scroll`, `Move`, `Shortcut`, `App`, `Shell`, `Wait`, `Scrape`
- `Snapshot(use_vision=true)` returns screenshot + interactive element coordinates
- Webview buttons show coords `(0,0)` in accessibility tree — must use vision coordinates instead
- **Before clicking in Extension Dev Host, snap both VS Code windows side-by-side on the SAME screen** (user has dual monitors; otherwise clicks land on the wrong window)
- Extension Dev Host starts at x=960 when snapped to right half of 1920-wide monitor
- Remember to click the reload button on the top of the main VS Code window to reload the extension after building.
