# Pixel Agents

A VS Code extension that turns your AI coding agents into animated pixel art characters in a virtual office.

Each Claude Code terminal you open spawns a character that walks around, sits at desks, and visually reflects what the agent is doing — typing when writing code, reading when searching files, waiting when it needs your attention.

Based on the original [Pixel Agents extension](https://marketplace.visualstudio.com/items?itemName=pablodelucca.pixel-agents) by pablodelucca. This fork by **hootbu** adds seat management, task/sub-agent visualization, and other improvements.

![Pixel Agents screenshot](webview-ui/public/Screenshot.jpg)

## Features

- **One agent, one character** — every Claude Code terminal gets its own animated character
- **Live activity tracking** — characters animate based on what the agent is actually doing (writing, reading, running commands)
- **Seat management** — assign agents to specific desks, reassign with click-to-select UI, seats auto-generated from chair furniture
- **Task panel & sub-agents** — real-time panel showing agent activities; Task tool sub-agents spawn as separate characters linked to their parent
- **Office layout editor** — design your office with floors, walls, and furniture using a built-in editor
- **Speech bubbles** — visual indicators when an agent is waiting for input or needs permission
- **Sound notifications** — optional chime when an agent finishes its turn
- **Persistent layouts** — your office design is saved and shared across VS Code windows
- **Diverse characters** — 6 diverse characters with hue-shifted variants

<p align="center">
  <img src="webview-ui/public/characters.png" alt="Pixel Agents characters" width="320" height="72" style="image-rendering: pixelated;">
</p>

## Seats

Seats are auto-generated from chair furniture placed in the layout editor. Each chair footprint tile becomes a seat; multi-tile chairs (like couches) produce multiple seats.

- **Auto-assignment** — when an agent spawns, it claims the first available seat
- **Seat Mode** — toggle Seat Mode from the toolbar, click an agent to select it (white outline), then click an available seat to reassign
- **Visual indicators** — blue = your seat, green = available, red = occupied by another agent
- **Smart facing** — characters face the adjacent desk automatically based on furniture orientation
- **Persistence** — seat assignments are saved per workspace and restored across sessions

When idle, agents stay seated for 2-4 minutes before wandering around the office, then return to their assigned seat.

## Task Panel & Sub-Agents

The Task panel (toggle via the button in the bottom-right toolbar) shows all active agents and their current activities in real time.

- **Live status** — each agent displays its current tool activity (Reading, Writing, Running command, Idle)
- **Sub-agent spawning** — when Claude Code's Task tool creates a sub-agent, a new character spawns near the parent with a matrix-style animation
- **Nested display** — sub-agents appear indented below their parent in the Task panel
- **Permission bubbles** — amber dots and speech bubbles appear when a sub-agent needs user approval
- **Auto-cleanup** — sub-agents despawn automatically when their task completes
- **Click to focus** — click any agent in the Task panel to jump to its terminal

Sub-agents inherit their parent's character palette and are placed at the closest free seat.

## Requirements

- VS Code 1.109.0 or later
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and configured

## Getting Started

### Install from source

```bash
git clone https://github.com/pablodelucca/pixel-agents.git
cd pixel-agents
npm install
cd webview-ui && npm install && cd ..
npm run build
```

Then press **F5** in VS Code to launch the Extension Development Host.

### Build & install via .vsix

To build, package, and install as a `.vsix` extension in one step, add this alias to your `~/.zshrc`:

```bash
alias pxbuild="cd ~/Documents/pixel-agents-dev && npm run build && npx vsce package --no-dependencies && code --install-extension pixel-agents-1.0.0.vsix --force"
```

Then run `pxbuild` from any terminal. After installation, reload VS Code (**Cmd+Shift+P → Reload Window**).

### Usage

1. Open the **Pixel Agents** panel (it appears in the bottom panel area alongside your terminal)
2. Click **+ Agent** to spawn a new Claude Code terminal and its character
3. Start coding with Claude — watch the character react in real time
4. Click a character to select it, then click a seat to reassign it
5. Open the **Task panel** to monitor agent activities and sub-agent spawning
6. Click **Layout** to open the office editor and customize your space

## Layout Editor

The built-in editor lets you design your office:

- **Floor** — Full HSB color control
- **Walls** — Auto-tiling walls with color customization
- **Tools** — Select, paint, erase, place, eyedropper, pick
- **Undo/Redo** — 50 levels with Ctrl+Z / Ctrl+Y
- **Export/Import** — Share layouts as JSON files via the Settings modal

The grid is expandable up to 64×64 tiles. Click the ghost border outside the current grid to grow it.

### Office Assets

The office tileset used in this project and available via the extension is **[Office Interior Tileset (16x16)](https://donarg.itch.io/officetileset)** by **Donarg**, available on itch.io for **$2 USD**.

This is the only part of the project that is not freely available. The tileset is not included in this repository due to its license. To use Pixel Agents locally with the full set of office furniture and decorations, purchase the tileset and run the asset import pipeline:

```bash
npm run import-tileset
```

Fair warning: the import pipeline is not exactly straightforward — the out-of-the-box tileset assets aren't the easiest to work with, and while I've done my best to make the process as smooth as possible, it may require some manual tweaking. If you have experience creating pixel art office assets and would like to contribute freely usable tilesets for the community, that would be hugely appreciated.

The extension will still work without the tileset — you'll get the default characters and basic layout, but the full furniture catalog requires the imported assets.

## How It Works

Pixel Agents watches Claude Code's JSONL transcript files to track what each agent is doing. When an agent uses a tool (like writing a file or running a command), the extension detects it and updates the character's animation accordingly. No modifications to Claude Code are needed — it's purely observational.

The webview runs a lightweight game loop with canvas rendering, BFS pathfinding, and a character state machine (idle → walk → type/read). Everything is pixel-perfect at integer zoom levels.

## Tech Stack

- **Extension**: TypeScript, VS Code Webview API, esbuild
- **Webview**: React 19, TypeScript, Vite, Canvas 2D

## Known Limitations

- **Agent-terminal sync** — the way agents are connected to Claude Code terminal instances is not super robust and sometimes desyncs, especially when terminals are rapidly opened/closed or restored across sessions.
- **Heuristic-based status detection** — Claude Code's JSONL transcript format does not provide clear signals for when an agent is waiting for user input or when it has finished its turn. The current detection is based on heuristics (idle timers, turn-duration events) and often misfires — agents may briefly show the wrong status or miss transitions.
- **Windows-only testing** — the extension has only been tested on Windows 11. It may work on macOS or Linux, but there could be unexpected issues with file watching, paths, or terminal behavior on those platforms.

## Roadmap

Implemented in this fork:

- ~~**Desks as directories / seat assignment**~~ — agents can be assigned to specific desks via Seat Mode
- ~~**Sub-agent visualization**~~ — Task tool sub-agents spawn as separate characters with real-time tracking

Still open for contributions:

- **Improve agent-terminal reliability** — more robust connection and sync between characters and Claude Code instances
- **Better status detection** — find or propose clearer signals for agent state transitions (waiting, done, permission needed)
- **Community assets** — freely usable pixel art tilesets or characters that anyone can use without purchasing third-party assets
- **Agent creation and definition** — define agents with custom skills, system prompts, names, and skins before launching them
- **Claude Code agent teams** — native support for [agent teams](https://code.claude.com/docs/en/agent-teams), visualizing multi-agent coordination and communication
- **Git worktree support** — agents working in different worktrees to avoid conflict from parallel work on the same files
- **Support for other agentic frameworks** — [OpenCode](https://github.com/nichochar/opencode), or really any kind of agentic experiment you'd want to run inside a pixel art interface (see [simile.ai](https://simile.ai/) for inspiration)

If any of these interest you, feel free to open an issue or submit a PR.

## Contributions

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for instructions on how to contribute to this project.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## Maintainer

This fork is maintained by **hootbu**. Seats, Task panel, sub-agent visualization, and related improvements were added on top of the original project by [pablodelucca](https://github.com/pablodelucca).

## Supporting the Original Project

If you find Pixel Agents useful, consider supporting the original author:

<a href="https://github.com/sponsors/pablodelucca">
  <img src="https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?logo=github" alt="GitHub Sponsors">
</a>
<a href="https://ko-fi.com/pablodelucca">
  <img src="https://img.shields.io/badge/Support-Ko--fi-ff5e5b?logo=ko-fi" alt="Ko-fi">
</a>

## License

This project is licensed under the [MIT License](LICENSE).
