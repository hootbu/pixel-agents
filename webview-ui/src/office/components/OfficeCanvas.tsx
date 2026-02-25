import { useRef, useEffect, useCallback } from 'react'
import type { OfficeState } from '../engine/officeState.js'
import type { EditorState } from '../editor/editorState.js'
import type { EditorRenderState, SelectionRenderState, DeleteButtonBounds, RotateButtonBounds, EditButtonBounds, LayerButtonBounds } from '../engine/renderer.js'
import { startGameLoop } from '../engine/gameLoop.js'
import { renderFrame } from '../engine/renderer.js'
import { TILE_SIZE, EditTool, FurnitureType } from '../types.js'
import { CAMERA_FOLLOW_LERP, CAMERA_FOLLOW_SNAP_THRESHOLD, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, ZOOM_SCROLL_THRESHOLD, PAN_MARGIN_FRACTION } from '../../constants.js'
import { getCatalogEntry, getEffectiveCatalogEntry, isRotatable } from '../layout/furnitureCatalog.js'
import { canPlaceFurniture, getWallPlacementRow } from '../editor/editorActions.js'
import { vscode } from '../../vscodeApi.js'
import { unlockAudio } from '../../notificationSound.js'

interface OfficeCanvasProps {
  officeState: OfficeState
  onClick: (agentId: number) => void
  isEditMode: boolean
  isSeatMode: boolean
  editorState: EditorState
  onEditorTileAction: (col: number, row: number) => void
  onEditorEraseAction: (col: number, row: number) => void
  onEditorSelectionChange: () => void
  onDeleteSelected: () => void
  onRotateSelected: () => void
  onDragMove: (uid: string, newCol: number, newRow: number) => void
  onEditText?: (uid: string) => void
  onLayerToggle?: () => void
  editorTick: number
  zoom: number
  onZoomChange: (zoom: number) => void
  panRef: React.MutableRefObject<{ x: number; y: number }>
}

export function OfficeCanvas({ officeState, onClick, isEditMode, isSeatMode, editorState, onEditorTileAction, onEditorEraseAction, onEditorSelectionChange, onDeleteSelected, onRotateSelected, onDragMove, onEditText, onLayerToggle, editorTick: _editorTick, zoom, onZoomChange, panRef }: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  // Middle-mouse pan state (imperative, no re-renders)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 })
  // Delete/rotate/edit button bounds (updated each frame by renderer)
  const deleteButtonBoundsRef = useRef<DeleteButtonBounds | null>(null)
  const rotateButtonBoundsRef = useRef<RotateButtonBounds | null>(null)
  const editButtonBoundsRef = useRef<EditButtonBounds | null>(null)
  const layerButtonBoundsRef = useRef<LayerButtonBounds | null>(null)
  // Right-click erase dragging
  const isEraseDraggingRef = useRef(false)
  // Zoom scroll accumulator for trackpad pinch sensitivity
  const zoomAccumulatorRef = useRef(0)

  // Clamp pan so the map edge can't go past a margin inside the viewport
  const clampPan = useCallback((px: number, py: number): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: px, y: py }
    const layout = officeState.getLayout()
    const mapW = layout.cols * TILE_SIZE * zoom
    const mapH = layout.rows * TILE_SIZE * zoom
    const marginX = canvas.width * PAN_MARGIN_FRACTION
    const marginY = canvas.height * PAN_MARGIN_FRACTION
    const maxPanX = (mapW / 2) + canvas.width / 2 - marginX
    const maxPanY = (mapH / 2) + canvas.height / 2 - marginY
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, px)),
      y: Math.max(-maxPanY, Math.min(maxPanY, py)),
    }
  }, [officeState, zoom])

  // Resize canvas backing store to device pixels (no DPR transform on ctx)
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    // No ctx.scale(dpr) — we render directly in device pixels
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    resizeCanvas()

    const observer = new ResizeObserver(() => resizeCanvas())
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    const stop = startGameLoop(canvas, {
      update: (dt) => {
        officeState.update(dt)
      },
      render: (ctx) => {
        // Canvas dimensions are in device pixels
        const w = canvas.width
        const h = canvas.height

        // Build editor render state
        let editorRender: EditorRenderState | undefined
        if (isEditMode) {
          const showGhostBorder = editorState.activeTool === EditTool.TILE_PAINT || editorState.activeTool === EditTool.WALL_PAINT || editorState.activeTool === EditTool.ERASE
          editorRender = {
            showGrid: true,
            ghostSprite: null,
            ghostCol: editorState.ghostCol,
            ghostRow: editorState.ghostRow,
            ghostValid: editorState.ghostValid,
            selectedCol: 0,
            selectedRow: 0,
            selectedW: 0,
            selectedH: 0,
            hasSelection: false,
            isRotatable: false,
            isPixelText: false,
            selectedZLayer: 0,
            deleteButtonBounds: null,
            rotateButtonBounds: null,
            editButtonBounds: null,
            layerButtonBounds: null,
            showGhostBorder,
            ghostBorderHoverCol: showGhostBorder ? editorState.ghostCol : -999,
            ghostBorderHoverRow: showGhostBorder ? editorState.ghostRow : -999,
          }

          // Ghost preview for furniture placement
          if (editorState.activeTool === EditTool.FURNITURE_PLACE && editorState.ghostCol >= 0) {
            if (editorState.selectedFurnitureType === FurnitureType.PIXEL_TEXT) {
              // Show a small "T" placeholder ghost for pixel_text
              const placementRow = getWallPlacementRow(editorState.selectedFurnitureType, editorState.ghostRow)
              // Simple "T" icon sprite (16x16)
              const t = '#FFFFFF'
              const _ = ''
              const tSprite = [
                [t,t,t,t,t,t,t,t,t,t,t,t,t,t,t,t],
                [t,t,t,t,t,t,t,t,t,t,t,t,t,t,t,t],
                [_,_,_,_,_,_,t,t,t,t,_,_,_,_,_,_],
                [_,_,_,_,_,_,t,t,t,t,_,_,_,_,_,_],
                [_,_,_,_,_,_,t,t,t,t,_,_,_,_,_,_],
                [_,_,_,_,_,_,t,t,t,t,_,_,_,_,_,_],
                [_,_,_,_,_,_,t,t,t,t,_,_,_,_,_,_],
                [_,_,_,_,_,_,t,t,t,t,_,_,_,_,_,_],
                [_,_,_,_,_,_,t,t,t,t,_,_,_,_,_,_],
                [_,_,_,_,_,_,t,t,t,t,_,_,_,_,_,_],
                [_,_,_,_,_,_,t,t,t,t,_,_,_,_,_,_],
                [_,_,_,_,_,_,t,t,t,t,_,_,_,_,_,_],
                [_,_,_,_,_,_,t,t,t,t,_,_,_,_,_,_],
                [_,_,_,_,_,_,t,t,t,t,_,_,_,_,_,_],
                [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
                [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
              ]
              editorRender.ghostSprite = tSprite
              editorRender.ghostRow = placementRow
              // Valid on any non-VOID tile (including walls — pixel text can go on walls)
              const layout = officeState.getLayout()
              const hoverIdx = editorState.ghostRow * layout.cols + editorState.ghostCol
              const tileVal = hoverIdx >= 0 && hoverIdx < layout.tiles.length ? layout.tiles[hoverIdx] : undefined
              editorRender.ghostValid = tileVal !== undefined && tileVal !== 8 /* TileType.VOID */
            } else {
              const entry = getCatalogEntry(editorState.selectedFurnitureType)
              if (entry) {
                const placementRow = getWallPlacementRow(editorState.selectedFurnitureType, editorState.ghostRow)
                editorRender.ghostSprite = entry.sprite
                editorRender.ghostRow = placementRow
                editorRender.ghostValid = canPlaceFurniture(
                  officeState.getLayout(),
                  editorState.selectedFurnitureType,
                  editorState.ghostCol,
                  placementRow,
                )
              }
            }
          }

          // Ghost preview for drag-to-move
          if (editorState.isDragMoving && editorState.dragUid && editorState.ghostCol >= 0) {
            const draggedItem = officeState.getLayout().furniture.find((f) => f.uid === editorState.dragUid)
            if (draggedItem) {
              const entry = draggedItem.type === FurnitureType.PIXEL_TEXT
                ? getEffectiveCatalogEntry(draggedItem.type, draggedItem.textConfig)
                : getCatalogEntry(draggedItem.type)
              if (entry) {
                const ghostCol = editorState.ghostCol - editorState.dragOffsetCol
                const ghostRow = editorState.ghostRow - editorState.dragOffsetRow
                editorRender.ghostSprite = entry.sprite
                editorRender.ghostCol = ghostCol
                editorRender.ghostRow = ghostRow
                editorRender.ghostValid = canPlaceFurniture(
                  officeState.getLayout(),
                  draggedItem.type,
                  ghostCol,
                  ghostRow,
                  editorState.dragUid,
                  draggedItem.textConfig,
                )
              }
            }
          }

          // Selection highlight
          if (editorState.selectedFurnitureUid && !editorState.isDragMoving) {
            const item = officeState.getLayout().furniture.find((f) => f.uid === editorState.selectedFurnitureUid)
            if (item) {
              const entry = item.type === FurnitureType.PIXEL_TEXT
                ? getEffectiveCatalogEntry(item.type, item.textConfig)
                : getCatalogEntry(item.type)
              if (entry) {
                editorRender.hasSelection = true
                editorRender.selectedCol = item.col
                editorRender.selectedRow = item.row
                editorRender.selectedW = entry.footprintW
                editorRender.selectedH = entry.footprintH
                editorRender.isRotatable = isRotatable(item.type)
                editorRender.isPixelText = item.type === FurnitureType.PIXEL_TEXT
                editorRender.selectedZLayer = item.zLayer || 0
              }
            }
          }
        }

        // Camera follow: smoothly center on followed agent
        if (officeState.cameraFollowId !== null) {
          const followCh = officeState.characters.get(officeState.cameraFollowId)
          if (followCh) {
            const layout = officeState.getLayout()
            const mapW = layout.cols * TILE_SIZE * zoom
            const mapH = layout.rows * TILE_SIZE * zoom
            const targetX = mapW / 2 - followCh.x * zoom
            const targetY = mapH / 2 - followCh.y * zoom
            const dx = targetX - panRef.current.x
            const dy = targetY - panRef.current.y
            if (Math.abs(dx) < CAMERA_FOLLOW_SNAP_THRESHOLD && Math.abs(dy) < CAMERA_FOLLOW_SNAP_THRESHOLD) {
              panRef.current = { x: targetX, y: targetY }
            } else {
              panRef.current = {
                x: panRef.current.x + dx * CAMERA_FOLLOW_LERP,
                y: panRef.current.y + dy * CAMERA_FOLLOW_LERP,
              }
            }
          }
        }

        // Build selection render state
        const selectionRender: SelectionRenderState = {
          selectedAgentId: officeState.selectedAgentId,
          hoveredAgentId: officeState.hoveredAgentId,
          hoveredTile: officeState.hoveredTile,
          seats: officeState.seats,
          characters: officeState.characters,
        }

        const { offsetX, offsetY } = renderFrame(
          ctx,
          w,
          h,
          officeState.tileMap,
          officeState.furniture,
          officeState.getCharacters(),
          zoom,
          panRef.current.x,
          panRef.current.y,
          selectionRender,
          editorRender,
          officeState.getLayout().tileColors,
          officeState.getLayout().cols,
          officeState.getLayout().rows,
        )
        offsetRef.current = { x: offsetX, y: offsetY }

        // Store delete/rotate/edit/layer button bounds for hit-testing
        deleteButtonBoundsRef.current = editorRender?.deleteButtonBounds ?? null
        rotateButtonBoundsRef.current = editorRender?.rotateButtonBounds ?? null
        editButtonBoundsRef.current = editorRender?.editButtonBounds ?? null
        layerButtonBoundsRef.current = editorRender?.layerButtonBounds ?? null
      },
    })

    return () => {
      stop()
      observer.disconnect()
    }
  }, [officeState, resizeCanvas, isEditMode, editorState, _editorTick, zoom, panRef])

  // Convert CSS mouse coords to world (sprite pixel) coords
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      // CSS coords relative to canvas
      const cssX = clientX - rect.left
      const cssY = clientY - rect.top
      // Convert to device pixels
      const deviceX = cssX * dpr
      const deviceY = cssY * dpr
      // Convert to world (sprite pixel) coords
      const worldX = (deviceX - offsetRef.current.x) / zoom
      const worldY = (deviceY - offsetRef.current.y) / zoom
      return { worldX, worldY, screenX: cssX, screenY: cssY, deviceX, deviceY }
    },
    [zoom],
  )

  const screenToTile = useCallback(
    (clientX: number, clientY: number): { col: number; row: number } | null => {
      const pos = screenToWorld(clientX, clientY)
      if (!pos) return null
      const col = Math.floor(pos.worldX / TILE_SIZE)
      const row = Math.floor(pos.worldY / TILE_SIZE)
      const layout = officeState.getLayout()
      // In edit mode with floor/wall/erase tool, extend valid range by 1 for ghost border
      if (isEditMode && (editorState.activeTool === EditTool.TILE_PAINT || editorState.activeTool === EditTool.WALL_PAINT || editorState.activeTool === EditTool.ERASE)) {
        if (col < -1 || col > layout.cols || row < -1 || row > layout.rows) return null
        return { col, row }
      }
      if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) return null
      return { col, row }
    },
    [screenToWorld, officeState, isEditMode, editorState],
  )

  // Check if device-pixel coords hit the delete button
  const hitTestDeleteButton = useCallback((deviceX: number, deviceY: number): boolean => {
    const bounds = deleteButtonBoundsRef.current
    if (!bounds) return false
    const dx = deviceX - bounds.cx
    const dy = deviceY - bounds.cy
    return (dx * dx + dy * dy) <= (bounds.radius + 2) * (bounds.radius + 2) // small padding
  }, [])

  // Check if device-pixel coords hit the rotate button
  const hitTestRotateButton = useCallback((deviceX: number, deviceY: number): boolean => {
    const bounds = rotateButtonBoundsRef.current
    if (!bounds) return false
    const dx = deviceX - bounds.cx
    const dy = deviceY - bounds.cy
    return (dx * dx + dy * dy) <= (bounds.radius + 2) * (bounds.radius + 2)
  }, [])

  // Check if device-pixel coords hit the edit button
  const hitTestEditButton = useCallback((deviceX: number, deviceY: number): boolean => {
    const bounds = editButtonBoundsRef.current
    if (!bounds) return false
    const dx = deviceX - bounds.cx
    const dy = deviceY - bounds.cy
    return (dx * dx + dy * dy) <= (bounds.radius + 2) * (bounds.radius + 2)
  }, [])

  // Check if device-pixel coords hit the layer button
  const hitTestLayerButton = useCallback((deviceX: number, deviceY: number): boolean => {
    const bounds = layerButtonBoundsRef.current
    if (!bounds) return false
    const dx = deviceX - bounds.cx
    const dy = deviceY - bounds.cy
    return (dx * dx + dy * dy) <= (bounds.radius + 2) * (bounds.radius + 2)
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Handle middle-mouse panning
      if (isPanningRef.current) {
        const dpr = window.devicePixelRatio || 1
        const dx = (e.clientX - panStartRef.current.mouseX) * dpr
        const dy = (e.clientY - panStartRef.current.mouseY) * dpr
        panRef.current = clampPan(
          panStartRef.current.panX + dx,
          panStartRef.current.panY + dy,
        )
        return
      }

      if (isEditMode) {
        const tile = screenToTile(e.clientX, e.clientY)
        if (tile) {
          editorState.ghostCol = tile.col
          editorState.ghostRow = tile.row

          // Drag-to-move: check if cursor moved to different tile
          if (editorState.dragUid && !editorState.isDragMoving) {
            if (tile.col !== editorState.dragStartCol || tile.row !== editorState.dragStartRow) {
              editorState.isDragMoving = true
            }
          }

          // Paint on drag (tile/wall/erase paint tool only, not during furniture drag)
          if (editorState.isDragging && (editorState.activeTool === EditTool.TILE_PAINT || editorState.activeTool === EditTool.WALL_PAINT || editorState.activeTool === EditTool.ERASE) && !editorState.dragUid) {
            onEditorTileAction(tile.col, tile.row)
          }
          // Right-click erase drag
          if (isEraseDraggingRef.current && (editorState.activeTool === EditTool.TILE_PAINT || editorState.activeTool === EditTool.WALL_PAINT || editorState.activeTool === EditTool.ERASE)) {
            const layout = officeState.getLayout()
            if (tile.col >= 0 && tile.col < layout.cols && tile.row >= 0 && tile.row < layout.rows) {
              onEditorEraseAction(tile.col, tile.row)
            }
          }
        } else {
          editorState.ghostCol = -1
          editorState.ghostRow = -1
        }

        // Cursor: show grab during drag, pointer over delete button, crosshair otherwise
        const canvas = canvasRef.current
        if (canvas) {
          if (editorState.isDragMoving) {
            canvas.style.cursor = 'grabbing'
          } else {
            const pos = screenToWorld(e.clientX, e.clientY)
            if (pos && (hitTestDeleteButton(pos.deviceX, pos.deviceY) || hitTestRotateButton(pos.deviceX, pos.deviceY) || hitTestEditButton(pos.deviceX, pos.deviceY) || hitTestLayerButton(pos.deviceX, pos.deviceY))) {
              canvas.style.cursor = 'pointer'
            } else if (editorState.activeTool === EditTool.FURNITURE_PICK && tile) {
              // Pick mode: show pointer over furniture, crosshair elsewhere
              const layout = officeState.getLayout()
              const hitFurniture = layout.furniture.find((f) => {
                const entry = getEffectiveCatalogEntry(f.type, f.textConfig)
                if (!entry) return false
                return tile.col >= f.col && tile.col < f.col + entry.footprintW && tile.row >= f.row && tile.row < f.row + entry.footprintH
              })
              canvas.style.cursor = hitFurniture ? 'pointer' : 'crosshair'
            } else if ((editorState.activeTool === EditTool.SELECT || (editorState.activeTool === EditTool.FURNITURE_PLACE && editorState.selectedFurnitureType === '')) && tile) {
              // Check if hovering over furniture
              const layout = officeState.getLayout()
              const hitFurniture = layout.furniture.find((f) => {
                const entry = getEffectiveCatalogEntry(f.type, f.textConfig)
                if (!entry) return false
                return tile.col >= f.col && tile.col < f.col + entry.footprintW && tile.row >= f.row && tile.row < f.row + entry.footprintH
              })
              canvas.style.cursor = hitFurniture ? 'grab' : 'crosshair'
            } else {
              canvas.style.cursor = 'crosshair'
            }
          }
        }
        return
      }

      const pos = screenToWorld(e.clientX, e.clientY)
      if (!pos) return
      const hitId = officeState.getCharacterAt(pos.worldX, pos.worldY)
      const tile = screenToTile(e.clientX, e.clientY)
      officeState.hoveredTile = tile
      const canvas = canvasRef.current
      if (canvas) {
        let cursor = 'default'
        if (hitId !== null) {
          cursor = 'pointer'
        } else if (officeState.selectedAgentId !== null && tile) {
          // Check if hovering over a clickable seat (available or own)
          const seatId = officeState.getSeatAtTile(tile.col, tile.row)
          if (seatId) {
            const seat = officeState.seats.get(seatId)
            if (seat) {
              const selectedCh = officeState.characters.get(officeState.selectedAgentId)
              if (!seat.assigned || (selectedCh && selectedCh.seatId === seatId)) {
                cursor = 'pointer'
              }
            }
          }
        }
        canvas.style.cursor = cursor
      }
      officeState.hoveredAgentId = hitId
    },
    [officeState, screenToWorld, screenToTile, isEditMode, editorState, onEditorTileAction, onEditorEraseAction, panRef, hitTestDeleteButton, hitTestRotateButton, hitTestEditButton, hitTestLayerButton, clampPan],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      unlockAudio()
      // Middle mouse button (button 1) starts panning
      if (e.button === 1) {
        e.preventDefault()
        // Break camera follow on manual pan
        officeState.cameraFollowId = null
        isPanningRef.current = true
        panStartRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          panX: panRef.current.x,
          panY: panRef.current.y,
        }
        const canvas = canvasRef.current
        if (canvas) canvas.style.cursor = 'grabbing'
        return
      }

      // Right-click in edit mode for erasing
      if (e.button === 2 && isEditMode) {
        const tile = screenToTile(e.clientX, e.clientY)
        if (tile && (editorState.activeTool === EditTool.TILE_PAINT || editorState.activeTool === EditTool.WALL_PAINT || editorState.activeTool === EditTool.ERASE)) {
          const layout = officeState.getLayout()
          if (tile.col >= 0 && tile.col < layout.cols && tile.row >= 0 && tile.row < layout.rows) {
            isEraseDraggingRef.current = true
            onEditorEraseAction(tile.col, tile.row)
          }
        }
        return
      }

      if (!isEditMode) return

      // Check rotate/delete/edit button hit first
      const pos = screenToWorld(e.clientX, e.clientY)
      if (pos && hitTestLayerButton(pos.deviceX, pos.deviceY)) {
        if (editorState.selectedFurnitureUid && onLayerToggle) {
          onLayerToggle()
        }
        return
      }
      if (pos && hitTestEditButton(pos.deviceX, pos.deviceY)) {
        if (editorState.selectedFurnitureUid && onEditText) {
          onEditText(editorState.selectedFurnitureUid)
        }
        return
      }
      if (pos && hitTestRotateButton(pos.deviceX, pos.deviceY)) {
        onRotateSelected()
        return
      }
      if (pos && hitTestDeleteButton(pos.deviceX, pos.deviceY)) {
        onDeleteSelected()
        return
      }

      const tile = screenToTile(e.clientX, e.clientY)

      // SELECT tool (or furniture tool with nothing selected): check for furniture hit to start drag
      const actAsSelect = editorState.activeTool === EditTool.SELECT ||
        (editorState.activeTool === EditTool.FURNITURE_PLACE && editorState.selectedFurnitureType === '')
      if (actAsSelect && tile) {
        const layout = officeState.getLayout()
        // Find all furniture at clicked tile, prefer surface items (on top of desks)
        let hitFurniture = null as typeof layout.furniture[0] | null
        for (const f of layout.furniture) {
          const entry = getEffectiveCatalogEntry(f.type, f.textConfig)
          if (!entry) continue
          if (tile.col >= f.col && tile.col < f.col + entry.footprintW && tile.row >= f.row && tile.row < f.row + entry.footprintH) {
            if (!hitFurniture || entry.canPlaceOnSurfaces) hitFurniture = f
          }
        }
        if (hitFurniture) {
          // Start drag — record offset from furniture's top-left
          editorState.startDrag(
            hitFurniture.uid,
            tile.col,
            tile.row,
            tile.col - hitFurniture.col,
            tile.row - hitFurniture.row,
          )
          return
        } else {
          // Clicked empty space — deselect
          editorState.clearSelection()
          onEditorSelectionChange()
        }
      }

      // Non-select tools: start paint drag
      editorState.isDragging = true
      if (tile) {
        onEditorTileAction(tile.col, tile.row)
      }
    },
    [officeState, isEditMode, editorState, screenToTile, screenToWorld, onEditorTileAction, onEditorEraseAction, onEditorSelectionChange, onDeleteSelected, onRotateSelected, onEditText, onLayerToggle, hitTestDeleteButton, hitTestRotateButton, hitTestEditButton, hitTestLayerButton, panRef],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        isPanningRef.current = false
        const canvas = canvasRef.current
        if (canvas) canvas.style.cursor = isEditMode ? 'crosshair' : 'default'
        return
      }
      if (e.button === 2) {
        isEraseDraggingRef.current = false
        return
      }

      // Handle drag-to-move completion
      if (editorState.dragUid) {
        if (editorState.isDragMoving) {
          // Compute target position
          const ghostCol = editorState.ghostCol - editorState.dragOffsetCol
          const ghostRow = editorState.ghostRow - editorState.dragOffsetRow
          const draggedItem = officeState.getLayout().furniture.find((f) => f.uid === editorState.dragUid)
          if (draggedItem) {
            const valid = canPlaceFurniture(
              officeState.getLayout(),
              draggedItem.type,
              ghostCol,
              ghostRow,
              editorState.dragUid,
              draggedItem.textConfig,
            )
            if (valid) {
              onDragMove(editorState.dragUid, ghostCol, ghostRow)
            }
          }
          editorState.clearSelection()
        } else {
          // Click (no movement) — toggle selection
          if (editorState.selectedFurnitureUid === editorState.dragUid) {
            editorState.clearSelection()
          } else {
            editorState.selectedFurnitureUid = editorState.dragUid
          }
        }
        editorState.clearDrag()
        onEditorSelectionChange()
        const canvas = canvasRef.current
        if (canvas) canvas.style.cursor = 'crosshair'
        return
      }

      editorState.isDragging = false
      editorState.wallDragAdding = null
    },
    [editorState, isEditMode, officeState, onDragMove, onEditorSelectionChange],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isEditMode) return // handled by mouseDown/mouseUp
      const pos = screenToWorld(e.clientX, e.clientY)
      if (!pos) return

      const hitId = officeState.getCharacterAt(pos.worldX, pos.worldY)

      // --- Seat assignment mode ---
      if (isSeatMode) {
        if (hitId !== null) {
          officeState.dismissBubble(hitId)
          // Toggle selection without opening terminal
          if (officeState.selectedAgentId === hitId) {
            officeState.selectedAgentId = null
            officeState.cameraFollowId = null
          } else {
            officeState.selectedAgentId = hitId
            officeState.cameraFollowId = hitId
          }
          return
        }
        // No agent hit — check seat click while agent is selected
        if (officeState.selectedAgentId !== null) {
          const selectedCh = officeState.characters.get(officeState.selectedAgentId)
          if (selectedCh && !selectedCh.isSubagent) {
            const tile = screenToTile(e.clientX, e.clientY)
            if (tile) {
              const seatId = officeState.getSeatAtTile(tile.col, tile.row)
              if (seatId) {
                const seat = officeState.seats.get(seatId)
                if (seat && selectedCh) {
                  if (selectedCh.seatId === seatId) {
                    officeState.sendToSeat(officeState.selectedAgentId)
                    officeState.selectedAgentId = null
                    officeState.cameraFollowId = null
                    return
                  } else if (!seat.assigned) {
                    officeState.reassignSeat(officeState.selectedAgentId, seatId)
                    officeState.selectedAgentId = null
                    officeState.cameraFollowId = null
                    // Persist seat assignments (exclude sub-agents)
                    const seats: Record<number, { palette: number; seatId: string | null }> = {}
                    for (const ch of officeState.characters.values()) {
                      if (ch.isSubagent) continue
                      seats[ch.id] = { palette: ch.palette, seatId: ch.seatId }
                    }
                    vscode.postMessage({ type: 'saveAgentSeats', seats })
                    // Also persist name → seat mapping
                    const names: Record<string, { seatId: string; palette: number; hueShift: number }> = {}
                    for (const ch of officeState.characters.values()) {
                      if (ch.isSubagent || !ch.name) continue
                      names[ch.name] = { seatId: ch.seatId || '', palette: ch.palette, hueShift: ch.hueShift }
                    }
                    vscode.postMessage({ type: 'saveAgentNames', names })
                    return
                  }
                }
              }
            }
          }
          // Clicked empty space — deselect
          officeState.selectedAgentId = null
          officeState.cameraFollowId = null
        }
        return
      }

      // --- Normal mode ---
      if (hitId !== null) {
        officeState.dismissBubble(hitId)
        if (officeState.selectedAgentId === hitId) {
          officeState.selectedAgentId = null
          officeState.cameraFollowId = null
        } else {
          officeState.selectedAgentId = hitId
          officeState.cameraFollowId = hitId
        }
        onClick(hitId) // focus terminal
        return
      }

      // No agent hit — deselect
      if (officeState.selectedAgentId !== null) {
        officeState.selectedAgentId = null
        officeState.cameraFollowId = null
      }
    },
    [officeState, onClick, screenToWorld, screenToTile, isEditMode, isSeatMode],
  )

  const handleMouseLeave = useCallback(() => {
    isPanningRef.current = false
    isEraseDraggingRef.current = false
    editorState.isDragging = false
    editorState.wallDragAdding = null
    editorState.clearDrag()
    editorState.ghostCol = -1
    editorState.ghostRow = -1
    officeState.hoveredAgentId = null
    officeState.hoveredTile = null
  }, [officeState, editorState])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (isEditMode) return
    // Right-click to walk selected agent to tile
    if (officeState.selectedAgentId !== null) {
      const tile = screenToTile(e.clientX, e.clientY)
      if (tile) {
        officeState.walkToTile(officeState.selectedAgentId, tile.col, tile.row)
      }
    }
  }, [isEditMode, officeState, screenToTile])

  // Wheel: Ctrl+wheel to zoom, plain wheel/trackpad to pan
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        // Accumulate scroll delta, step zoom when threshold crossed
        zoomAccumulatorRef.current += e.deltaY
        if (Math.abs(zoomAccumulatorRef.current) >= ZOOM_SCROLL_THRESHOLD) {
          const delta = zoomAccumulatorRef.current < 0 ? ZOOM_STEP : -ZOOM_STEP
          zoomAccumulatorRef.current = 0
          const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta))
          if (newZoom !== zoom) {
            onZoomChange(newZoom)
          }
        }
      } else {
        // Pan via trackpad two-finger scroll or mouse wheel
        const dpr = window.devicePixelRatio || 1
        officeState.cameraFollowId = null
        panRef.current = clampPan(
          panRef.current.x - e.deltaX * dpr,
          panRef.current.y - e.deltaY * dpr,
        )
      }
    },
    [zoom, onZoomChange, officeState, panRef, clampPan],
  )

  // Prevent default middle-click browser behavior (auto-scroll)
  const handleAuxClick = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) e.preventDefault()
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#1E1E2E',
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onAuxClick={handleAuxClick}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        style={{ display: 'block' }}
      />
    </div>
  )
}
