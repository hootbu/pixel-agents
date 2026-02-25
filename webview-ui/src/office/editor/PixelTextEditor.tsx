import { useState, useEffect, useRef } from 'react'
import type { PixelTextConfig } from '../types.js'
import { getTextFootprint } from '../sprites/textSpriteCache.js'
import { generateTextSprite } from '../sprites/pixelFont.js'

interface PixelTextEditorProps {
  initialConfig?: PixelTextConfig
  onConfirm: (config: PixelTextConfig) => void
  onCancel: () => void
}

const PRESET_COLORS = [
  { label: 'White', hex: '#FFFFFF' },
  { label: 'Red', hex: '#FF0000' },
  { label: 'Blue', hex: '#4488FF' },
  { label: 'Green', hex: '#00CC00' },
  { label: 'Yellow', hex: '#FFCC00' },
  { label: 'Orange', hex: '#FF8800' },
  { label: 'Pink', hex: '#FF66CC' },
  { label: 'Cyan', hex: '#00CCCC' },
  { label: 'Purple', hex: '#9966FF' },
  { label: 'Lime', hex: '#66FF00' },
  { label: 'Coral', hex: '#FF6666' },
  { label: 'Gray', hex: '#888888' },
  { label: 'Teal', hex: '#008888' },
  { label: 'Black', hex: '#222222' },
]

const FONT_OPTIONS = ['3x5', '5x7'] as const
const SCALE_OPTIONS = [1, 2, 3, 4, 5] as const

export function PixelTextEditor({ initialConfig, onConfirm, onCancel }: PixelTextEditorProps) {
  const [text, setText] = useState(initialConfig?.text ?? '')
  const [fontSize, setFontSize] = useState(initialConfig?.fontSize ?? '3x5')
  const [pixelScale, setPixelScale] = useState(initialConfig?.pixelScale ?? 1)
  const [textColor, setTextColor] = useState(initialConfig?.textColor ?? '#FFFFFF')
  const [colorInput, setColorInput] = useState(initialConfig?.textColor ?? '#FFFFFF')
  const inputRef = useRef<HTMLInputElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const config: PixelTextConfig = { text, fontSize, pixelScale, textColor }
  const footprint = text ? getTextFootprint(config) : { w: 0, h: 0 }

  // Draw preview
  useEffect(() => {
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!text) {
      canvas.width = 120
      canvas.height = 30
      ctx.fillStyle = '#1e1e2e'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#666'
      ctx.font = '12px monospace'
      ctx.fillText('Type something...', 10, 20)
      return
    }

    const sprite = generateTextSprite(text, fontSize, textColor, pixelScale)
    const rows = sprite.length
    const cols = sprite[0]?.length ?? 0

    const scale = Math.max(1, Math.min(3, Math.floor(200 / Math.max(cols, 1))))
    canvas.width = Math.max(120, cols * scale + 8)
    canvas.height = Math.max(30, rows * scale + 8)

    ctx.fillStyle = '#1e1e2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const ox = Math.floor((canvas.width - cols * scale) / 2)
    const oy = Math.floor((canvas.height - rows * scale) / 2)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const color = sprite[r][c]
        if (!color) continue
        ctx.fillStyle = color
        ctx.fillRect(ox + c * scale, oy + r * scale, scale, scale)
      }
    }
  }, [text, fontSize, pixelScale, textColor])

  const handleColorInput = (val: string) => {
    setColorInput(val)
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setTextColor(val)
    }
  }

  const handleConfirm = () => {
    if (!text.trim()) return
    onConfirm(config)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
    e.stopPropagation()
  }

  const btnStyle: React.CSSProperties = {
    padding: '4px 10px',
    fontSize: '14px',
    background: '#2a2a4a',
    color: '#ccc',
    border: '2px solid #4a4a6a',
    borderRadius: 0,
    cursor: 'pointer',
  }
  const btnActiveStyle: React.CSSProperties = {
    ...btnStyle,
    background: '#4a4a8a',
    color: '#fff',
    border: '2px solid #6a6aaa',
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 200,
        background: '#1e1e2e',
        border: '2px solid #4a4a6a',
        borderRadius: 0,
        padding: '16px',
        minWidth: 320,
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      onKeyDown={handleKeyDown}
    >
      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>Pixel Text</div>

      {/* Text input */}
      <div>
        <label style={{ fontSize: '12px', color: '#999', display: 'block', marginBottom: 4 }}>Text</label>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={32}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '14px',
            background: '#0e0e1e',
            color: '#fff',
            border: '2px solid #4a4a6a',
            borderRadius: 0,
            outline: 'none',
            boxSizing: 'border-box',
          }}
          placeholder="Enter text..."
        />
      </div>

      {/* Preview */}
      <div style={{ textAlign: 'center' }}>
        <canvas
          ref={previewCanvasRef}
          style={{ borderRadius: 0, border: '1px solid #333' }}
        />
      </div>

      {/* Font size toggle */}
      <div>
        <label style={{ fontSize: '12px', color: '#999', display: 'block', marginBottom: 4 }}>Font</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {FONT_OPTIONS.map((f) => (
            <button
              key={f}
              style={fontSize === f ? btnActiveStyle : btnStyle}
              onClick={() => setFontSize(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Pixel scale */}
      <div>
        <label style={{ fontSize: '12px', color: '#999', display: 'block', marginBottom: 4 }}>Scale</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {SCALE_OPTIONS.map((s) => (
            <button
              key={s}
              style={pixelScale === s ? btnActiveStyle : btnStyle}
              onClick={() => setPixelScale(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div>
        <label style={{ fontSize: '12px', color: '#999', display: 'block', marginBottom: 4 }}>Color</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {PRESET_COLORS.map((c) => (
            <button
              key={c.hex}
              title={c.label}
              onClick={() => { setTextColor(c.hex); setColorInput(c.hex) }}
              style={{
                width: 24,
                height: 24,
                background: c.hex,
                border: textColor === c.hex ? '2px solid #fff' : '2px solid #4a4a6a',
                borderRadius: 0,
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="color"
            value={textColor}
            onChange={(e) => { setTextColor(e.target.value); setColorInput(e.target.value) }}
            style={{
              width: 32,
              height: 32,
              padding: 0,
              border: '2px solid #4a4a6a',
              borderRadius: 0,
              cursor: 'pointer',
              background: 'none',
            }}
          />
          <input
            type="text"
            value={colorInput}
            onChange={(e) => handleColorInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: 90,
              padding: '4px 6px',
              fontSize: '12px',
              background: '#0e0e1e',
              color: '#fff',
              border: '2px solid #4a4a6a',
              borderRadius: 0,
              outline: 'none',
            }}
            placeholder="#FFFFFF"
          />
        </div>
      </div>

      {/* Footprint info */}
      {text && (
        <div style={{ fontSize: '11px', color: '#888' }}>
          Size: {footprint.w} x {footprint.h} tiles
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button style={btnStyle} onClick={onCancel}>Cancel</button>
        <button
          style={{
            ...btnStyle,
            background: text.trim() ? '#2a6a2a' : '#333',
            color: text.trim() ? '#fff' : '#666',
            cursor: text.trim() ? 'pointer' : 'default',
          }}
          onClick={handleConfirm}
          disabled={!text.trim()}
        >
          {initialConfig ? 'Update' : 'Place'}
        </button>
      </div>
    </div>
  )
}
