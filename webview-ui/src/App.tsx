import { useState, useCallback, useRef } from 'react'
import { OfficeState } from './office/engine/officeState.js'
import { OfficeCanvas } from './office/components/OfficeCanvas.js'
import { ToolOverlay } from './office/components/ToolOverlay.js'
import { EditorToolbar } from './office/editor/EditorToolbar.js'
import { EditorState } from './office/editor/editorState.js'
import { vscode } from './vscodeApi.js'
import { useExtensionMessages } from './hooks/useExtensionMessages.js'
import { useEditorActions } from './hooks/useEditorActions.js'
import { useEditorKeyboard } from './hooks/useEditorKeyboard.js'
import { FloatingButtons } from './components/FloatingButtons.js'
import { AgentLabels } from './components/AgentLabels.js'
import { DebugView } from './components/DebugView.js'

// Game state lives outside React — updated imperatively by message handlers
const officeStateRef = { current: null as OfficeState | null }
const editorState = new EditorState()

function getOfficeState(): OfficeState {
  if (!officeStateRef.current) {
    officeStateRef.current = new OfficeState()
  }
  return officeStateRef.current
}

function App() {
  const { agents, selectedAgent, agentTools, agentStatuses, subagentTools, layoutReady } = useExtensionMessages(getOfficeState)

  const editor = useEditorActions(getOfficeState, editorState)

  const [isDebugMode, setIsDebugMode] = useState(false)

  const handleToggleDebugMode = useCallback(() => setIsDebugMode((prev) => !prev), [])

  const handleSelectAgent = useCallback((id: number) => {
    vscode.postMessage({ type: 'focusAgent', id })
  }, [])

  const [hoveredAgent, setHoveredAgent] = useState<number | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const [editorTickForKeyboard, setEditorTickForKeyboard] = useState(0)
  useEditorKeyboard(
    editor.isEditMode,
    editorState,
    editor.handleDeleteSelected,
    editor.handleUndo,
    useCallback(() => setEditorTickForKeyboard((n) => n + 1), []),
  )

  const handleHover = useCallback((agentId: number | null, screenX: number, screenY: number) => {
    setHoveredAgent(agentId)
    setHoverPos({ x: screenX, y: screenY })
  }, [])

  const handleClick = useCallback((agentId: number) => {
    vscode.postMessage({ type: 'focusAgent', id: agentId })
  }, [])

  const officeState = getOfficeState()

  // Force dependency on editorTickForKeyboard to propagate keyboard-triggered re-renders
  void editorTickForKeyboard

  if (!layoutReady) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-foreground)' }}>
        Loading...
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes arcadia-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .arcadia-pulse { animation: arcadia-pulse 1.5s ease-in-out infinite; }
      `}</style>

      <OfficeCanvas
        officeState={officeState}
        onHover={handleHover}
        onClick={handleClick}
        isEditMode={editor.isEditMode}
        editorState={editorState}
        onEditorTileAction={editor.handleEditorTileAction}
        editorTick={editor.editorTick}
        zoom={editor.zoom}
        onZoomChange={editor.handleZoomChange}
        panRef={editor.panRef}
      />

      <FloatingButtons
        isEditMode={editor.isEditMode}
        isDebugMode={isDebugMode}
        zoom={editor.zoom}
        onOpenClaude={editor.handleOpenClaude}
        onToggleEditMode={editor.handleToggleEditMode}
        onToggleDebugMode={handleToggleDebugMode}
        onZoomChange={editor.handleZoomChange}
      />

      {editor.isEditMode && (
        <EditorToolbar
          activeTool={editorState.activeTool}
          selectedTileType={editorState.selectedTileType}
          selectedFurnitureType={editorState.selectedFurnitureType}
          selectedFurnitureUid={editorState.selectedFurnitureUid}
          onToolChange={editor.handleToolChange}
          onTileTypeChange={editor.handleTileTypeChange}
          onFurnitureTypeChange={editor.handleFurnitureTypeChange}
          onDeleteSelected={editor.handleDeleteSelected}
          onUndo={editor.handleUndo}
          onReset={editor.handleReset}
        />
      )}

      <AgentLabels
        officeState={officeState}
        agents={agents}
        agentStatuses={agentStatuses}
        containerRef={containerRef}
        zoom={editor.zoom}
        panRef={editor.panRef}
      />

      <ToolOverlay
        agentId={hoveredAgent}
        screenX={hoverPos.x}
        screenY={hoverPos.y}
        agentTools={agentTools}
        agentStatuses={agentStatuses}
        subagentTools={subagentTools}
      />

      {isDebugMode && (
        <DebugView
          agents={agents}
          selectedAgent={selectedAgent}
          agentTools={agentTools}
          agentStatuses={agentStatuses}
          subagentTools={subagentTools}
          onSelectAgent={handleSelectAgent}
        />
      )}
    </div>
  )
}

export default App
