'use client'

import { Trash2, Plus, X, Workflow } from 'lucide-react'
import type { CanvasElement, FlowNode } from '@/lib/types/canvas'
import { descendantIds } from '@/lib/flowchart-layout'
import { FlowLinkPicker } from './FlowLinkPicker'
import { PublicFlowchartElement } from './PublicFlowchartElement'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function FlowchartElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const nodes: FlowNode[] = element.flowNodes ?? []
  const set = (next: FlowNode[]) => onChange({ flowNodes: next })
  const update = (id: string, patch: Partial<FlowNode>) =>
    set(nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  const remove = (id: string) =>
    set(nodes.filter((n) => n.id !== id).map((n) => (n.parentId === id ? { ...n, parentId: undefined } : n)))
  const add = () =>
    set([...nodes, { id: `fn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: 'New step' }])

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${isSelected ? 'ring-2 ring-primary border-primary/30' : 'border-border hover:border-primary/30'}`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-primary" />
          <input
            value={element.flowTitle ?? ''}
            onChange={(e) => onChange({ flowTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Workflow title"
            className="text-sm font-semibold bg-transparent border-none outline-none flex-1"
          />
        </div>

        {/* Blocks */}
        <div className="space-y-2">
          {nodes.map((n) => {
            const banned = descendantIds(nodes, n.id)
            const parentOptions = nodes.filter((o) => o.id !== n.id && !banned.has(o.id))
            return (
              <div key={n.id} data-testid={`flow-block-${n.id}`} className="rounded-lg border border-border p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={n.icon ?? ''}
                    onChange={(e) => update(n.id, { icon: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="🙂"
                    className="w-10 text-sm text-center bg-transparent border border-border rounded px-1 py-1"
                  />
                  <input
                    value={n.title}
                    onChange={(e) => update(n.id, { title: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Title"
                    className="text-sm bg-transparent border border-border rounded px-2 py-1 flex-1 min-w-0"
                  />
                  <input
                    type="color"
                    value={n.color ?? '#e2e8f0'}
                    onChange={(e) => update(n.id, { color: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 border border-border rounded"
                  />
                  <button onClick={(e) => { e.stopPropagation(); remove(n.id) }} className="p-1 text-muted-foreground hover:text-destructive" aria-label={`delete-${n.id}`}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <textarea
                  value={n.description ?? ''}
                  onChange={(e) => update(n.id, { description: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full text-sm bg-transparent border border-border rounded px-2 py-1"
                />

                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Comes after</label>
                  <select
                    aria-label={`parent-${n.id}`}
                    value={n.parentId ?? ''}
                    onChange={(e) => update(n.id, { parentId: e.target.value || undefined })}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs border border-border rounded px-1 py-1"
                  >
                    <option value="">— (start / root)</option>
                    {parentOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.title || o.id}</option>
                    ))}
                  </select>
                  <input
                    value={n.branchLabel ?? ''}
                    onChange={(e) => update(n.id, { branchLabel: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Arrow label (e.g. Yes)"
                    className="text-xs bg-transparent border border-border rounded px-2 py-1 flex-1 min-w-0"
                  />
                </div>

                <FlowLinkPicker
                  value={{ url: n.linkUrl, label: n.linkLabel }}
                  onPick={(v) => update(n.id, { linkUrl: v.url, linkLabel: v.label })}
                />
              </div>
            )
          })}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); add() }}
          className="flex items-center gap-1.5 text-sm text-primary hover:opacity-80 font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add block
        </button>

        {/* Live preview */}
        {nodes.length > 0 && (
          <div className="pt-2 border-t border-border">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Preview</div>
            <div className="pointer-events-none">
              <PublicFlowchartElement element={element} />
            </div>
          </div>
        )}
      </div>

      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
