# Changelog

All notable changes to **Pixel Agents** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.5] - 2026-04-15

### Added
- Per-agent permission mode prompt on agent creation — choose Normal or Skip Permissions (`--dangerously-skip-permissions`) for each new agent.

## [1.2.4] - 2026-04-13

### Fixed
- Usage panel showing no data in workspaces whose paths contain underscores or dots — project-hash matching now mirrors Claude Code's hashing rule (all non-alphanumeric chars become `-`).

## [1.2.3] - 2026-03-10

### Added
- Costume mode — change agent appearance at runtime with 6 character models and a hue-shift slider, persisted across sessions.
- Mood reactions — happy, error, and stressed emoji bubbles based on agent activity.
- Achievement system — 8 unlockable achievements with toast notifications and a gallery view in Settings.
- Office pets — cats and dogs with AI-driven behaviors (wander, approach idle agents, sleep, flee active agents); up to 5 pets, configurable in Settings.
- Feature screenshots in README (Tasks, Achievements, Usage, Costume).

### Changed
- README updated and version bumped to 1.2.3.

## [1.2.2] - 2026-03-09

### Added
- Real-time token usage panel with per-agent breakdown and stacked color-coded progress bars (Input / Output / Cache Write / Cache Read).

### Changed
- Code structure refactored for improved readability and maintainability.

## [1.2.1] - 2026-03-06

### Changed
- Logo updated and copyright notice added.

## [1.2.0] - 2026-02-25

### Added
- Pixel text furniture type with dynamic sprite rendering.
- Pixel text editor with edit/layer buttons and z-layer toggle — render text in front of walls but behind characters.

### Fixed
- Z-order regressions — switched to footprint-based sorting instead of sprite-height sorting.

### Changed
- Version bumped to 1.2.0.
- README updated with pixel text and z-layer feature.
- Removed "supporting original project" section from README.

## [1.1.0] - 2026-02-25

### Added
- Adaptive agent state detection with smarter permission timers and early completion signals.
- Zoom persistence — chosen zoom level remembered across sessions and window reloads.
- Pixel-perfect 1px zoom steps with the level displayed in pixels.
- Webview context retention — panel state preserved when switching to another panel and back.
- Seat mode, task panel, and character name rendering.
- Agent naming and name-based seat persistence.
- Turkish (TR) translation of the README and a release install section.

### Changed
- Package identifiers updated for the fork (`hootbu.pixel-agent`).
- README updated with status detection improvements, contributor attribution, fork-specific feature list, build alias, and seats/tasks documentation.
- Dependencies updated.
- ESLint warnings cleaned up across extension source files.

## [1.0.0] - 2026-02-24

Initial release of the **hootbu** fork, based on the original `pablodelucca.pixel-agents` extension.

### Added
- VS Code extension with React + Vite webview.
- Multi-session Claude Code launcher with agent navigation buttons.
- Real-time agent status tracking via JSONL transcript watching.
- Auto-detection of existing Claude Code terminals; agent close buttons.
- One-agent-per-terminal model with `/clear` detection and terminal–agent sync.
- Persistence of agent state across extension reloads via `workspaceState`.
- Subagent activity tracking with nested tool display.
- Pixel art office UI with 4-directional animations and tile-based movement.
- Office layout editor with drag-and-drop furniture and persistent layouts.
- Pixel-perfect rendering with integer zoom and middle-click pan.
- Asset loading system and a 7-stage tileset import pipeline.
- Donarg Office Tileset integration with build-time sprite extraction.
- Right-click to walk an agent to a tile.
- JSONL transcript viewer tool.
- Sound notification when an agent completes a turn.
- Trackpad panning with scroll limits and reduced zoom sensitivity.
- Layout export/import and a redesigned Settings modal.
- Custom office bundled as the default layout for new users.
- User-level layout file at `~/.pixel-agents/layout.json` for cross-window sync.
- Matrix-style spawn/despawn effect for agent characters.
- Detection of permission-waiting sub-agents with approval bubbles.
- Decoupled camera follow from selection; sub-agents spawn near their parent.
- Dynamic grid sizing, VOID tiles, erase tool, and grid expansion.
- Diverse palette assignment with random hue shifts for repeated skins.
- Pre-colored character sprite PNGs with per-palette loading.
- Furniture state toggles and flexible rotation groups for electronics.
- Wall furniture category with `canPlaceOnWalls` flag.
- Wall paint tool, wall colorization, and wall z-sorting with placement blocking.
- Wall auto-tiles, furniture colorization, and a pick tool.
- Surface placement for desk items with z-sort fix.
- Background tiles for tall furniture; asset-manager direct save.
- Unified asset manager editor.
- Rotatable furniture groups with `R` key, rotate button, and multi-stage `Esc`.
- Pattern-based floor tile system with colorization and eyedropper.
- Save button and Reset confirmation in the layout editor.
- Speech bubbles, seat persistence, and a sprite export script.
- Hover outline, smooth camera follow, and hover-only seat indicators.
- Agent selection with outline glow and seat reassignment.
- Hover/select activity overlay with close button (replaces always-on agent labels).
- Pixel art aesthetic restyle for all UI overlays (sharp corners, hard shadows).
- Debug view toggle for card-based agent tool status.
- Sub-agent characters as temporary office scene entities.
- Automatic terminal adoption for externally opened Claude Code sessions.
- Code of Conduct and Contributors documents.
- Default solid gray floor tile when `floors.png` is missing.
- README sections for known limitations, roadmap, contributor info, and getting started.

### Changed
- Renamed project from "Arcadia" to "Pixel Agents".
- Refactored monolithic files into a modular architecture.
- Refactored to session-centric agents; removed folder/persistence/stale-detection code paths.
- Improved JSONL parsing for dual-communication.
- Multi-tile chair z-sorting, multi-seat support, and orientation-based facing.
- Character z-sorting fix, sitting offset, removal of idle animations, blocked walking on chair tiles.
- HSL adjust mode for furniture colorization with pick-tool color copy.
- Furniture color picker moved to selected items with universal support.
- Layout editor UX simplified with drag-to-move, redo, and an action bar.
- Magic numbers and strings consolidated into centralized constants files.

### Fixed
- ON/OFF state toggling for electronics assets.
- Wall item placement on back walls after grid expansion.
- Idle detection — rely solely on `turn_duration`; remove text-based fallback (later re-added as a careful fallback).
- Text-idle timer — suppressed during tool-using turns.

### Removed
- Scaffold boilerplate, unused test infrastructure, and stale config files.

[Unreleased]: https://github.com/hootbu/pixel-agents/compare/v1.2.5...HEAD
[1.2.5]: https://github.com/hootbu/pixel-agents/releases/tag/v1.2.5
[1.2.4]: https://github.com/hootbu/pixel-agents/releases/tag/v1.2.4
[1.2.3]: https://github.com/hootbu/pixel-agents/releases/tag/v1.2.3
[1.2.2]: https://github.com/hootbu/pixel-agents/releases/tag/v1.2.2
[1.2.1]: https://github.com/hootbu/pixel-agents/releases/tag/v1.2.1
[1.2.0]: https://github.com/hootbu/pixel-agents/releases/tag/v1.2.0
[1.1.0]: https://github.com/hootbu/pixel-agents/releases/tag/v1.1.0
[1.0.0]: https://github.com/hootbu/pixel-agents/releases/tag/v1.0.0
