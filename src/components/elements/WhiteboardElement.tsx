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

async function deleteBlob(url: string): Promise<void> {
  try {
    await fetch('/api/upload', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
  } catch { /* best-effort */ }
}

export function WhiteboardElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  // fabric Canvas instance (typed loosely to avoid a static fabric import at module scope)
  const fabricRef = useRef<any>(null)
  const fabricLibRef = useRef<any>(null)
  const historyRef = useRef<string[]>([])
  const redoRef = useRef<string[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRestoringRef = useRef(false)
  const prevPreviewRef = useRef<string>(element.whiteboardPreviewUrl || '')

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
      if (isBlankScene(scene)) {
        const old = prevPreviewRef.current
        prevPreviewRef.current = ''
        onChange({ whiteboardPreviewUrl: '' })
        if (old) void deleteBlob(old)
        return
      }
      try {
        const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 })
        const url = await uploadDataUrl(dataUrl, previewFilename(element.id))
        const old = prevPreviewRef.current
        prevPreviewRef.current = url
        onChange({ whiteboardPreviewUrl: url })
        if (old && old !== url) void deleteBlob(old)
      } catch { /* keep previous preview on failure */ }
    }, 600)
  }, [element.id, onChange])

  const snapshot = useCallback(() => {
    if (isRestoringRef.current) return
    const canvas = fabricRef.current
    if (!canvas) return
    historyRef.current = pushHistory(historyRef.current, JSON.stringify(canvas.toJSON()))
    redoRef.current = []
    persist()
  }, [persist])

  const styleRef = useRef({ strokeColor, fillColor, strokeWidth })
  const snapshotRef = useRef(snapshot)
  useEffect(() => { styleRef.current = { strokeColor, fillColor, strokeWidth } }, [strokeColor, fillColor, strokeWidth])
  useEffect(() => { snapshotRef.current = snapshot }, [snapshot])

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
  }, [tool, strokeColor, strokeWidth])

  // Shape/text/sticky pointer handlers.
  useEffect(() => {
    const canvas = fabricRef.current
    const fabric = fabricLibRef.current
    if (!canvas || !fabric) return
    if (['pen', 'highlighter', 'select'].includes(tool)) return

    let obj: any = null
    let start = { x: 0, y: 0 }

    const onDown = (opt: any) => {
      const { strokeColor, fillColor, strokeWidth } = styleRef.current
      const fill = fillColor ?? 'transparent'
      const p = canvas.getScenePoint(opt.e)
      start = { x: p.x, y: p.y }
      if (tool === 'rect') obj = new fabric.Rect({ left: p.x, top: p.y, width: 1, height: 1, fill, stroke: strokeColor, strokeWidth })
      else if (tool === 'ellipse') obj = new fabric.Ellipse({ left: p.x, top: p.y, rx: 1, ry: 1, fill, stroke: strokeColor, strokeWidth })
      else if (tool === 'line' || tool === 'arrow') obj = new fabric.Line([p.x, p.y, p.x, p.y], { stroke: strokeColor, strokeWidth })
      else if (tool === 'text') {
        obj = new fabric.Textbox('Text', { left: p.x, top: p.y, fontSize: 24, fill: strokeColor, width: 160 })
        canvas.add(obj); canvas.setActiveObject(obj); obj.enterEditing?.(); setTool('select'); snapshotRef.current(); return
      } else if (tool === 'sticky') {
        const bg = new fabric.Rect({ width: 160, height: 160, rx: 8, ry: 8, fill: fillColor ?? '#FEF08A' })
        const txt = new fabric.Textbox('Note', { width: 140, fontSize: 18, fill: '#111111', left: 10, top: 10 })
        obj = new fabric.Group([bg, txt], { left: p.x, top: p.y })
        canvas.add(obj); canvas.setActiveObject(obj); setTool('select'); snapshotRef.current(); return
      }
      if (obj) canvas.add(obj)
    }
    const onMove = (opt: any) => {
      if (!obj) return
      const p = canvas.getScenePoint(opt.e)
      if (tool === 'rect') obj.set({ width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y), left: Math.min(p.x, start.x), top: Math.min(p.y, start.y) })
      else if (tool === 'ellipse') obj.set({ rx: Math.abs(p.x - start.x) / 2, ry: Math.abs(p.y - start.y) / 2, left: Math.min(p.x, start.x), top: Math.min(p.y, start.y) })
      else if (tool === 'line' || tool === 'arrow') obj.set({ x2: p.x, y2: p.y })
      canvas.renderAll()
    }
    const onUp = () => {
      const { strokeColor, strokeWidth } = styleRef.current
      if (obj && (tool === 'arrow')) {
        // add a simple arrowhead as a triangle at the line end
        const triangle = new fabric.Triangle({
          left: obj.x2, top: obj.y2, width: strokeWidth * 4, height: strokeWidth * 4,
          fill: strokeColor, angle: (Math.atan2(obj.y2 - obj.y1, obj.x2 - obj.x1) * 180) / Math.PI + 90,
          originX: 'center', originY: 'center',
        })
        canvas.add(triangle)
      }
      obj = null
      setTool('select')
      snapshotRef.current()
    }
    canvas.on('mouse:down', onDown)
    canvas.on('mouse:move', onMove)
    canvas.on('mouse:up', onUp)
    return () => { canvas.off('mouse:down', onDown); canvas.off('mouse:move', onMove); canvas.off('mouse:up', onUp) }
  }, [tool])

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
    const target = historyRef.current[historyRef.current.length - 1]
    isRestoringRef.current = true
    canvas.loadFromJSON(target).then(() => { canvas.renderAll(); persist() }).finally(() => { isRestoringRef.current = false })
  }
  const redo = () => {
    const canvas = fabricRef.current
    if (!canvas || redoRef.current.length === 0) return
    const scene = redoRef.current[redoRef.current.length - 1]
    redoRef.current = redoRef.current.slice(0, -1)
    historyRef.current = pushHistory(historyRef.current, scene)
    isRestoringRef.current = true
    canvas.loadFromJSON(scene).then(() => { canvas.renderAll(); persist() }).finally(() => { isRestoringRef.current = false })
  }
  const clear = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    isRestoringRef.current = true
    canvas.getObjects().slice().forEach((o: any) => canvas.remove(o))
    isRestoringRef.current = false
    canvas.renderAll()
    snapshot()
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
      canvas.add(img); canvas.setActiveObject(img); canvas.renderAll(); snapshot()
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
