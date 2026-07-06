'use client'
import { useRef } from 'react'
import {
  MousePointer2, Pen, Highlighter, Square, Circle, Minus, ArrowRight,
  Type, StickyNote, Image as ImageIcon, Undo2, Redo2, Trash2, X,
} from 'lucide-react'
import { ARTBOARD_PRESETS } from '@/lib/whiteboard'

export type WhiteboardTool =
  | 'select' | 'pen' | 'highlighter' | 'rect' | 'ellipse' | 'line' | 'arrow'
  | 'text' | 'sticky' | 'image'

interface Props {
  tool: WhiteboardTool
  onToolChange: (t: WhiteboardTool) => void
  strokeColor: string
  fillColor: string | null
  strokeWidth: number
  onStyleChange: (s: { strokeColor?: string; fillColor?: string | null; strokeWidth?: number }) => void
  background: 'blank' | 'grid' | 'dots'
  onBackgroundChange: (b: 'blank' | 'grid' | 'dots') => void
  presetLabel: string
  onPresetChange: (label: string) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onDeleteSelection: () => void
  onAddImage: (file: File) => void
}

const TOOLS: { id: WhiteboardTool; icon: typeof Pen; title: string }[] = [
  { id: 'select', icon: MousePointer2, title: 'Select' },
  { id: 'pen', icon: Pen, title: 'Pen' },
  { id: 'highlighter', icon: Highlighter, title: 'Highlighter' },
  { id: 'rect', icon: Square, title: 'Rectangle' },
  { id: 'ellipse', icon: Circle, title: 'Ellipse' },
  { id: 'line', icon: Minus, title: 'Line' },
  { id: 'arrow', icon: ArrowRight, title: 'Arrow' },
  { id: 'text', icon: Type, title: 'Text' },
  { id: 'sticky', icon: StickyNote, title: 'Sticky note' },
  { id: 'image', icon: ImageIcon, title: 'Image' },
]

export function WhiteboardToolbar(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1.5 mb-2">
      {TOOLS.map(({ id, icon: Icon, title }) => (
        <button
          key={id} title={title} type="button"
          onClick={() => { if (id === 'image') fileRef.current?.click(); else props.onToolChange(id) }}
          className={`p-1.5 rounded-md ${props.tool === id ? 'bg-primary text-white' : 'hover:bg-muted'}`}
        ><Icon className="w-4 h-4" /></button>
      ))}
      <span className="mx-1 h-5 w-px bg-border" />
      <input type="color" title="Stroke" value={props.strokeColor}
        onChange={(e) => props.onStyleChange({ strokeColor: e.target.value })} className="h-7 w-7 rounded" />
      <input type="color" title="Fill" value={props.fillColor ?? '#ffffff'}
        onChange={(e) => props.onStyleChange({ fillColor: e.target.value })} className="h-7 w-7 rounded" />
      <button type="button" title="No fill" onClick={() => props.onStyleChange({ fillColor: null })}
        className={`p-1.5 rounded-md ${props.fillColor === null ? 'bg-primary text-white' : 'hover:bg-muted'}`}><X className="w-4 h-4" /></button>
      <input type="range" min={1} max={24} value={props.strokeWidth} title="Stroke width"
        onChange={(e) => props.onStyleChange({ strokeWidth: Number(e.target.value) })} className="w-20" />
      <span className="mx-1 h-5 w-px bg-border" />
      <button type="button" title="Undo" onClick={props.onUndo} className="p-1.5 rounded-md hover:bg-muted"><Undo2 className="w-4 h-4" /></button>
      <button type="button" title="Redo" onClick={props.onRedo} className="p-1.5 rounded-md hover:bg-muted"><Redo2 className="w-4 h-4" /></button>
      <button type="button" title="Delete selection" onClick={props.onDeleteSelection} className="p-1.5 rounded-md hover:bg-muted"><Trash2 className="w-4 h-4" /></button>
      <button type="button" title="Clear board" onClick={props.onClear} className="p-1.5 rounded-md text-xs hover:bg-muted">Clear</button>
      <span className="mx-1 h-5 w-px bg-border" />
      <select value={props.background} onChange={(e) => props.onBackgroundChange(e.target.value as 'blank'|'grid'|'dots')}
        className="text-xs rounded-md border border-border bg-surface px-1 py-1" title="Background">
        <option value="blank">Blank</option><option value="grid">Grid</option><option value="dots">Dots</option>
      </select>
      <select value={props.presetLabel} onChange={(e) => props.onPresetChange(e.target.value)}
        className="text-xs rounded-md border border-border bg-surface px-1 py-1" title="Size">
        {ARTBOARD_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
      </select>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onAddImage(f); e.currentTarget.value = '' }} />
    </div>
  )
}
