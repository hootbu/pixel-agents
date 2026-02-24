import { useState } from 'react'
import type { ToolActivity } from '../office/types.js'
import type { OfficeState } from '../office/engine/officeState.js'
import type { SubagentCharacter } from '../hooks/useExtensionMessages.js'
import { vscode } from '../vscodeApi.js'

interface TaskPanelProps {
  agents: number[]
  agentTools: Record<number, ToolActivity[]>
  agentStatuses: Record<number, string>
  subagentCharacters: SubagentCharacter[]
  officeState: OfficeState
}

function getActivityText(
  agentId: number,
  agentTools: Record<number, ToolActivity[]>,
  isActive: boolean,
): string {
  const tools = agentTools[agentId]
  if (tools && tools.length > 0) {
    const activeTool = [...tools].reverse().find((t) => !t.done)
    if (activeTool) {
      if (activeTool.permissionWait) return 'Needs approval'
      return activeTool.status
    }
    if (isActive) {
      const lastTool = tools[tools.length - 1]
      if (lastTool) return lastTool.status
    }
  }
  return 'Idle'
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 62,
  right: 30,
  width: 280,
  maxHeight: 'calc(100vh - 80px)',
  overflowY: 'auto',
  zIndex: 'var(--pixel-controls-z)' as unknown as number,
  background: 'var(--pixel-bg)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  boxShadow: 'var(--pixel-shadow)',
  padding: '6px 0',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: '22px',
  whiteSpace: 'nowrap',
}

const subRowStyle: React.CSSProperties = {
  ...rowStyle,
  paddingLeft: 24,
  fontSize: '20px',
  fontStyle: 'italic',
}

const emptyStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: '22px',
  color: 'var(--pixel-text-dim)',
}

export function TaskPanel({
  agents,
  agentTools,
  agentStatuses,
  subagentCharacters,
  officeState,
}: TaskPanelProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  if (agents.length === 0) {
    return (
      <div style={panelStyle}>
        <div style={emptyStyle}>No active agents</div>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      {agents.map((id) => {
        const ch = officeState.characters.get(id)
        const name = ch?.name || `Agent ${id}`
        const isActive = ch?.isActive ?? false
        const activityText = getActivityText(id, agentTools, isActive)

        const tools = agentTools[id]
        const hasPermission = tools?.some((t) => t.permissionWait && !t.done)
        const hasActiveTools = tools?.some((t) => !t.done)

        let dotColor: string | null = null
        if (hasPermission) {
          dotColor = 'var(--pixel-status-permission)'
        } else if (isActive && hasActiveTools) {
          dotColor = 'var(--pixel-status-active)'
        } else if (agentStatuses[id] === 'waiting') {
          dotColor = 'var(--pixel-green, #5ac88c)'
        }

        const subs = subagentCharacters.filter((s) => s.parentAgentId === id)

        return (
          <div key={id}>
            <div
              style={{
                ...rowStyle,
                background: hoveredId === id ? 'var(--pixel-btn-hover-bg)' : 'transparent',
              }}
              onClick={() => vscode.postMessage({ type: 'focusAgent', id })}
              onMouseEnter={() => setHoveredId(id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {dotColor ? (
                <span
                  className={isActive && !hasPermission ? 'pixel-agents-pulse' : undefined}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: dotColor,
                    flexShrink: 0,
                  }}
                />
              ) : (
                <span style={{ width: 6, flexShrink: 0 }} />
              )}
              <span
                style={{
                  color: 'var(--pixel-text)',
                  flexShrink: 0,
                }}
              >
                {name}
              </span>
              <span
                style={{
                  color: 'var(--pixel-text-dim)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginLeft: 'auto',
                  fontSize: '20px',
                }}
              >
                {activityText}
              </span>
            </div>
            {subs.map((sub) => {
              const subCh = officeState.characters.get(sub.id)
              const subHasPermission = subCh?.bubbleType === 'permission'

              return (
                <div
                  key={sub.id}
                  style={{
                    ...subRowStyle,
                    background: hoveredId === sub.id ? 'var(--pixel-btn-hover-bg)' : 'transparent',
                  }}
                  onClick={() => vscode.postMessage({ type: 'focusAgent', id })}
                  onMouseEnter={() => setHoveredId(sub.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {subHasPermission ? (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--pixel-status-permission)',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <span style={{ width: 6, flexShrink: 0 }} />
                  )}
                  <span style={{ color: 'var(--pixel-text-dim)' }}>
                    {subHasPermission ? 'Needs approval' : sub.label}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
