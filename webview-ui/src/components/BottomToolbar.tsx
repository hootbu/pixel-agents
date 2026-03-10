import { useState } from 'react'
import { SettingsModal } from './SettingsModal.js'
import type { PetConfig } from '../office/types.js'

interface BottomToolbarProps {
  isEditMode: boolean
  isSeatMode: boolean
  isCostumeMode: boolean
  onOpenClaude: () => void
  onToggleEditMode: () => void
  onToggleSeatMode: () => void
  onToggleCostumeMode: () => void
  isDebugMode: boolean
  onToggleDebugMode: () => void
  onOpenAchievements: () => void
  petsEnabled: boolean
  onTogglePets: () => void
  petData: PetConfig[]
  onUpdatePetData: (data: PetConfig[]) => void
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 10,
  left: 10,
  zIndex: 'var(--pixel-controls-z)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'var(--pixel-bg)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  padding: '4px 6px',
  boxShadow: 'var(--pixel-shadow)',
}

const btnBase: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: '24px',
  color: 'var(--pixel-text)',
  background: 'var(--pixel-btn-bg)',
  border: '2px solid transparent',
  borderRadius: 0,
  cursor: 'pointer',
}

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: 'var(--pixel-active-bg)',
  border: '2px solid var(--pixel-accent)',
}


export function BottomToolbar({
  isEditMode,
  isSeatMode,
  isCostumeMode,
  onOpenClaude,
  onToggleEditMode,
  onToggleSeatMode,
  onToggleCostumeMode,
  isDebugMode,
  onToggleDebugMode,
  onOpenAchievements,
  petsEnabled,
  onTogglePets,
  petData,
  onUpdatePetData,
}: BottomToolbarProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  return (
    <div style={panelStyle}>
      <button
        onClick={onOpenClaude}
        onMouseEnter={() => setHovered('agent')}
        onMouseLeave={() => setHovered(null)}
        style={{
          ...btnBase,
          padding: '5px 12px',
          background:
            hovered === 'agent'
              ? 'var(--pixel-agent-hover-bg)'
              : 'var(--pixel-agent-bg)',
          border: '2px solid var(--pixel-agent-border)',
          color: 'var(--pixel-agent-text)',
        }}
      >
        + Agent
      </button>
      <button
        onClick={onToggleEditMode}
        onMouseEnter={() => setHovered('edit')}
        onMouseLeave={() => setHovered(null)}
        style={
          isEditMode
            ? { ...btnActive }
            : {
                ...btnBase,
                background: hovered === 'edit' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
              }
        }
        title="Edit office layout"
      >
        Layout
      </button>
      <button
        onClick={onToggleSeatMode}
        onMouseEnter={() => setHovered('seat')}
        onMouseLeave={() => setHovered(null)}
        style={
          isSeatMode
            ? { ...btnActive }
            : {
                ...btnBase,
                background: hovered === 'seat' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
              }
        }
        title="Assign agents to desks"
      >
        Seats
      </button>
      <button
        onClick={onToggleCostumeMode}
        onMouseEnter={() => setHovered('costume')}
        onMouseLeave={() => setHovered(null)}
        style={
          isCostumeMode
            ? { ...btnActive }
            : {
                ...btnBase,
                background: hovered === 'costume' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
              }
        }
        title="Change agent costume"
      >
        Costume
      </button>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsSettingsOpen((v) => !v)}
          onMouseEnter={() => setHovered('settings')}
          onMouseLeave={() => setHovered(null)}
          style={
            isSettingsOpen
              ? { ...btnActive }
              : {
                  ...btnBase,
                  background: hovered === 'settings' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
                }
          }
          title="Settings"
        >
          Settings
        </button>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          isDebugMode={isDebugMode}
          onToggleDebugMode={onToggleDebugMode}
          onOpenAchievements={onOpenAchievements}
          petsEnabled={petsEnabled}
          onTogglePets={onTogglePets}
          petData={petData}
          onUpdatePetData={onUpdatePetData}
        />
      </div>
    </div>
  )
}
