import { vscode } from '../vscodeApi.js'

interface FloatingButtonsProps {
  isEditMode: boolean
  isDebugMode: boolean
  zoom: number
  onOpenClaude: () => void
  onToggleEditMode: () => void
  onToggleDebugMode: () => void
  onZoomChange: (zoom: number) => void
}

export function FloatingButtons({
  isEditMode,
  isDebugMode,
  zoom,
  onOpenClaude,
  onToggleEditMode,
  onToggleDebugMode,
  onZoomChange,
}: FloatingButtonsProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        display: 'flex',
        gap: 6,
        zIndex: 50,
      }}
    >
      <button
        onClick={onOpenClaude}
        style={{
          padding: '5px 10px',
          fontSize: '12px',
          background: 'var(--vscode-button-background)',
          color: 'var(--vscode-button-foreground)',
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
          opacity: 0.9,
        }}
      >
        + Agent
      </button>
      <button
        onClick={() => vscode.postMessage({ type: 'openSessionsFolder' })}
        style={{
          padding: '5px 10px',
          fontSize: '12px',
          background: 'var(--vscode-button-secondaryBackground, #3A3D41)',
          color: 'var(--vscode-button-secondaryForeground, #ccc)',
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
          opacity: 0.9,
        }}
        title="Open JSONL sessions folder"
      >
        Sessions
      </button>
      <button
        onClick={onToggleEditMode}
        style={{
          padding: '5px 10px',
          fontSize: '12px',
          background: isEditMode
            ? 'var(--vscode-button-background)'
            : 'var(--vscode-button-secondaryBackground, #3A3D41)',
          color: isEditMode
            ? 'var(--vscode-button-foreground)'
            : 'var(--vscode-button-secondaryForeground, #ccc)',
          border: isEditMode ? '1px solid var(--vscode-focusBorder, #007fd4)' : 'none',
          borderRadius: 3,
          cursor: 'pointer',
          opacity: 0.9,
        }}
        title="Toggle edit mode"
      >
        Edit
      </button>
      <button
        onClick={onToggleDebugMode}
        style={{
          padding: '5px 10px',
          fontSize: '12px',
          background: isDebugMode
            ? 'var(--vscode-button-background)'
            : 'var(--vscode-button-secondaryBackground, #3A3D41)',
          color: isDebugMode
            ? 'var(--vscode-button-foreground)'
            : 'var(--vscode-button-secondaryForeground, #ccc)',
          border: isDebugMode ? '1px solid var(--vscode-focusBorder, #007fd4)' : 'none',
          borderRadius: 3,
          cursor: 'pointer',
          opacity: 0.9,
        }}
        title="Toggle debug view"
      >
        Debug
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
        <button
          onClick={() => onZoomChange(zoom - 1)}
          disabled={zoom <= 1}
          style={{
            width: 22,
            height: 22,
            fontSize: '14px',
            lineHeight: '14px',
            padding: 0,
            background: 'var(--vscode-button-secondaryBackground, #3A3D41)',
            color: 'var(--vscode-button-secondaryForeground, #ccc)',
            border: 'none',
            borderRadius: 3,
            cursor: zoom <= 1 ? 'default' : 'pointer',
            opacity: zoom <= 1 ? 0.4 : 0.9,
          }}
          title="Zoom out (Ctrl+Scroll)"
        >
          -
        </button>
        <span style={{ fontSize: '11px', color: 'var(--vscode-foreground)', minWidth: 20, textAlign: 'center', opacity: 0.7 }}>
          {zoom}x
        </span>
        <button
          onClick={() => onZoomChange(zoom + 1)}
          disabled={zoom >= 10}
          style={{
            width: 22,
            height: 22,
            fontSize: '14px',
            lineHeight: '14px',
            padding: 0,
            background: 'var(--vscode-button-secondaryBackground, #3A3D41)',
            color: 'var(--vscode-button-secondaryForeground, #ccc)',
            border: 'none',
            borderRadius: 3,
            cursor: zoom >= 10 ? 'default' : 'pointer',
            opacity: zoom >= 10 ? 0.4 : 0.9,
          }}
          title="Zoom in (Ctrl+Scroll)"
        >
          +
        </button>
      </div>
    </div>
  )
}
