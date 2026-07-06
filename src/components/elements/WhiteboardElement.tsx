'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { ARTBOARD_PRESETS, pushHistory, previewFilename, isBlankScene } from '@/lib/whiteboard'
import { WhiteboardToolbar, type WhiteboardTool } from './WhiteboardToolbar'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

async function uploadDataUrl(dataUrl: string, filename: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  const fd = new FormData()
  fd.append('file', new File([blob], filename, { type: 'image/png' }))
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  if (!res.ok) throw new Error('upload failed')
  return (await res.json()).url as string
}

async function uploadImageFile(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  if (!res.ok) throw new Error('upload failed')
  return (await res.json()).url as string
}

export function WhiteboardElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  // fabric Canvas instance (typed loosely to avoid a static fabric import at module scope)
  const fabricRef = useRef<any>(null)
  const fabricLibRef = useRef<any>(null)
  const historyRef = useRef<string[]>([])
  const redoRef = useRef<string[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [tool, setTool] = useState<WhiteboardTool>('select')
  const [strokeColor, setStrokeColor] = useState('#111111')
  const [fillColor, setFillColor] = useState<string | null>('#39D98A')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [background, setBackground] = useState<'blank'|'grid'|'dots'>(element.whiteboardBackground || 'blank')
  const [presetLabel, setPresetLabel] = useState(
    ARTBOARD_PRESETS.find((p) => p.width === element.whiteboardWidth && p.height === element.whiteboardHeight)?.label
    || ARTBOARD_PRESETS[0].label
  )

  const width = element.whiteboardWidth || 800
  const height = element.whiteboardHeight || 450

  // Debounced persist: scene JSON + regenerated PNG preview.
  const persist = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const canvas = fabricRef.current
      if (!canvas) return
      const scene = JSON.stringify(canvas.toJSON())
      onChange({ whiteboardScene: scene })
      if (isBlankScene(scene)) { onChange({ whiteboardPreviewUrl: '' }); return }
      try {
        const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 })
        const url = await uploadDataUrl(dataUrl, previewFilename(element.id))
        onChange({ whiteboardPreviewUrl: url })
      } catch { /* keep previous preview on failure */ }
    }, 600)
  }, [element.id, onChange])

  const snapshot = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    historyRef.current = pushHistory(historyRef.current, JSON.stringify(canvas.toJSON()))
    redoRef.current = []
    persist()
  }, [persist])

  // Mount fabric once.
  useEffect(() => {
    let disposed = false
    ;(async () => {
      const fabric = await import('fabric')
      if (disposed || !canvasElRef.current) return
      fabricLibRef.current = fabric
      const canvas = new fabric.Canvas(canvasElRef.current, { width, height, backgroundColor: '#ffffff' })
      fabricRef.current = canvas
      if (!isBlankScene(element.whiteboardScene)) {
        await canvas.loadFromJSON(element.whiteboardScene!)
        canvas.renderAll()
      }
      historyRef.current = [JSON.stringify(canvas.toJSON())]
      applyBackground(canvas, fabric, background, width, height)
      canvas.on('object:added', snapshot)
      canvas.on('object:modified', snapshot)
      canvas.on('object:removed', snapshot)
      canvas.on('path:created', snapshot)
    })()
    return () => {
      disposed = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
      fabricRef.current?.dispose?.()
      fabricRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tool → fabric drawing mode.
  useEffect(() => {
    const canvas = fabricRef.current
    const fabric = fabricLibRef.current
    if (!canvas || !fabric) return
    canvas.isDrawingMode = tool === 'pen' || tool === 'highlighter'
    canvas.selection = tool === 'select'
    if (canvas.isDrawingMode) {
      const brush = new fabric.PencilBrush(canvas)
      brush.color = tool === 'highlighter' ? hexToRgba(strokeColor, 0.35) : strokeColor
      brush.width = tool === 'highlighter' ? strokeWidth * 4 : strokeWidth
      canvas.freeDrawingBrush = brush
    }
    // Shape/text/sticky pointer handlers are added in Task 5.
  }, [tool, strokeColor, strokeWidth])

  const onStyleChange = (s: { strokeColor?: string; fillColor?: string | null; strokeWidth?: number }) => {
    if (s.strokeColor !== undefined) setStrokeColor(s.strokeColor)
    if (s.fillColor !== undefined) setFillColor(s.fillColor)
    if (s.strokeWidth !== undefined) setStrokeWidth(s.strokeWidth)
    // Apply to the active object if any.
    const canvas = fabricRef.current
    const obj = canvas?.getActiveObject()
    if (obj) {
      if (s.strokeColor !== undefined) obj.set('stroke', s.strokeColor)
      if (s.fillColor !== undefined) obj.set('fill', s.fillColor ?? 'transparent')
      if (s.strokeWidth !== undefined) obj.set('strokeWidth', s.strokeWidth)
      canvas.renderAll(); snapshot()
    }
  }

  const deleteSelection = () => {
    const canvas = fabricRef.current
    canvas?.getActiveObjects()?.forEach((o: any) => canvas.remove(o))
    canvas?.discardActiveObject(); canvas?.renderAll()
  }
  const undo = () => {
    const canvas = fabricRef.current
    if (!canvas || historyRef.current.length < 2) return
    const cur = historyRef.current[historyRef.current.length - 1]
    redoRef.current = [...redoRef.current, cur]
    historyRef.current = historyRef.current.slice(0, -1)
    canvas.loadFromJSON(historyRef.current[historyRef.current.length - 1]).then(() => canvas.renderAll())
    persist()
  }
  const redo = () => {
    const canvas = fabricRef.current
    if (!canvas || redoRef.current.length === 0) return
    const scene = redoRef.current[redoRef.current.length - 1]
    redoRef.current = redoRef.current.slice(0, -1)
    historyRef.current = pushHistory(historyRef.current, scene)
    canvas.loadFromJSON(scene).then(() => canvas.renderAll())
    persist()
  }
  const clear = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.getObjects().slice().forEach((o: any) => canvas.remove(o))
    canvas.renderAll(); snapshot()
  }
  const changeBackground = (b: 'blank'|'grid'|'dots') => {
    setBackground(b); onChange({ whiteboardBackground: b })
    const canvas = fabricRef.current, fabric = fabricLibRef.current
    if (canvas && fabric) { applyBackground(canvas, fabric, b, width, height); persist() }
  }
  const changePreset = (label: string) => {
    const p = ARTBOARD_PRESETS.find((x) => x.label === label); if (!p) return
    setPresetLabel(label); onChange({ whiteboardWidth: p.width, whiteboardHeight: p.height })
    const canvas = fabricRef.current
    if (canvas) { canvas.setDimensions({ width: p.width, height: p.height }); canvas.renderAll(); persist() }
  }
  const addImage = async (file: File) => {
    const canvas = fabricRef.current, fabric = fabricLibRef.current
    if (!canvas || !fabric) return
    try {
      const url = await uploadImageFile(file)
      const img = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
      img.scaleToWidth(Math.min(300, width / 2))
      canvas.add(img); canvas.setActiveObject(img); canvas.renderAll()
    } catch { /* ignore */ }
  }

  return (
    <div onClick={onSelect} className={`relative rounded-xl border-2 p-2 ${isSelected ? 'border-primary' : 'border-transparent hover:border-border'}`}>
      <WhiteboardToolbar
        tool={tool} onToolChange={setTool}
        strokeColor={strokeColor} fillColor={fillColor} strokeWidth={strokeWidth} onStyleChange={onStyleChange}
        background={background} onBackgroundChange={changeBackground}
        presetLabel={presetLabel} onPresetChange={changePreset}
        onUndo={undo} onRedo={redo} onClear={clear} onDeleteSelection={deleteSelection} onAddImage={addImage}
      />
      <div className="overflow-auto">
        <canvas ref={canvasElRef} className="border border-border rounded-md" />
      </div>
      <button aria-label="Delete element" onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
    </div>
  )
}

// --- helpers (module-local, no React) ---
function hexToRgba(hex: string, a: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
function applyBackground(canvas: any, fabric: any, kind: 'blank'|'grid'|'dots', w: number, h: number) {
  if (kind === 'blank') { canvas.backgroundColor = '#ffffff'; canvas.renderAll(); return }
  // Build a small repeating pattern tile via an offscreen canvas.
  const tile = document.createElement('canvas'); tile.width = 20; tile.height = 20
  const ctx = tile.getContext('2d')!; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 20, 20)
  ctx.fillStyle = '#e2e8f0'
  if (kind === 'grid') { ctx.strokeStyle = '#e2e8f0'; ctx.strokeRect(0, 0, 20, 20) }
  else { ctx.beginPath(); ctx.arc(10, 10, 1.5, 0, Math.PI * 2); ctx.fill() }
  canvas.backgroundColor = new fabric.Pattern({ source: tile, repeat: 'repeat' })
  canvas.renderAll()
}
