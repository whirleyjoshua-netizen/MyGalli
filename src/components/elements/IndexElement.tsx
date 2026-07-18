'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Settings2 } from 'lucide-react'
import type { CanvasElement, IndexEntry } from '@/lib/types/canvas'
import { newEntryId } from '@/lib/index-element'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function IndexElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const entries = element.indexEntries ?? []
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const patchEntry = (id: string, updates: Partial<IndexEntry>) => {
    onChange({
      indexEntries: entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })
  }

  const addEntry = () => {
    const entry: IndexEntry = { id: newEntryId(), label: 'New entry', subtitle: '', linkUrl: '' }
    onChange({ indexEntries: [...entries, entry] })
    setExpandedId(entry.id)
  }

  const removeEntry = (id: string) => {
    onChange({ indexEntries: entries.filter((e) => e.id !== id) })
  }

  const moveEntry = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= entries.length) return
    const next = [...entries]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange({ indexEntries: next })
  }

  const setMeta = (id: string, meta: { key: string; value: string }[]) => patchEntry(id, { meta })

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border bg-white p-4 transition-shadow ${
        isSelected ? 'border-galli ring-2 ring-galli/30' : 'border-slate-200'
      }`}
    >
      {/* Header controls */}
      <div className="mb-3 flex items-center gap-2">
        <input
          value={element.indexIcon ?? ''}
          onChange={(e) => onChange({ indexIcon: e.target.value.slice(0, 2) })}
          className="w-12 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-lg"
          aria-label="Index icon (emoji)"
          placeholder="🔎"
        />
        <input
          value={element.indexTitle ?? ''}
          onChange={(e) => onChange({ indexTitle: e.target.value })}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold"
          placeholder="Index title"
        />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
          aria-label="Delete element"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Display options */}
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <label className="flex items-center gap-1.5">
          View
          <select
            value={element.indexView ?? 'list'}
            onChange={(e) => onChange({ indexView: e.target.value as 'list' | 'cards' })}
            className="rounded border border-slate-200 px-1.5 py-1"
          >
            <option value="list">List</option>
            <option value="cards">Cards</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={element.indexEnableSearch ?? true}
            onChange={(e) => onChange({ indexEnableSearch: e.target.checked })}
          />
          Search box
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={element.indexEnableNumbers ?? true}
            onChange={(e) => onChange({ indexEnableNumbers: e.target.checked })}
          />
          Auto-number
        </label>
        <label className="flex items-center gap-1.5">
          Accent
          <input
            type="color"
            value={element.indexAccent ?? '#39D98A'}
            onChange={(e) => onChange({ indexAccent: e.target.value })}
            className="h-6 w-8 rounded border border-slate-200"
          />
        </label>
      </div>

      {/* Entries */}
      <div className="space-y-2">
        {entries.map((entry, i) => {
          const open = expandedId === entry.id
          return (
            <div key={entry.id} className="rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 p-2">
                <GripVertical size={14} className="shrink-0 text-slate-300" />
                <div className="flex flex-col">
                  <button
                    onClick={(e) => { e.stopPropagation(); moveEntry(i, -1) }}
                    disabled={i === 0}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveEntry(i, 1) }}
                    disabled={i === entries.length - 1}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <input
                  value={entry.label}
                  onChange={(e) => patchEntry(entry.id, { label: e.target.value })}
                  className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm"
                  placeholder="Label"
                />
                <input
                  value={entry.subtitle ?? ''}
                  onChange={(e) => patchEntry(entry.id, { subtitle: e.target.value })}
                  className="w-32 rounded border border-slate-200 px-2 py-1 text-xs text-slate-500"
                  placeholder="Subtitle"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setExpandedId(open ? null : entry.id) }}
                  className={`rounded p-1.5 ${open ? 'bg-galli/10 text-galli' : 'text-slate-400 hover:bg-slate-100'}`}
                  aria-label="Edit details"
                >
                  <Settings2 size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeEntry(entry.id) }}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  aria-label="Delete entry"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {open && (
                <div className="space-y-2 border-t border-slate-100 bg-slate-50 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={entry.linkUrl ?? ''}
                      onChange={(e) => patchEntry(entry.id, { linkUrl: e.target.value })}
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                      placeholder="Link URL (https://… or /path)"
                    />
                    <input
                      value={entry.category ?? ''}
                      onChange={(e) => patchEntry(entry.id, { category: e.target.value })}
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                      placeholder="Category (group)"
                    />
                    <input
                      value={entry.image ?? ''}
                      onChange={(e) => patchEntry(entry.id, { image: e.target.value })}
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                      placeholder="Image URL (optional)"
                    />
                    <input
                      value={(entry.tags ?? []).join(', ')}
                      onChange={(e) =>
                        patchEntry(entry.id, {
                          tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                        })
                      }
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                      placeholder="Tags (comma-separated)"
                    />
                  </div>
                  <textarea
                    value={entry.note ?? ''}
                    onChange={(e) => patchEntry(entry.id, { note: e.target.value })}
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    rows={2}
                    placeholder="Note / description (shown when expanded)"
                  />
                  {/* Meta pairs (cap 4) */}
                  <div className="space-y-1.5">
                    {(entry.meta ?? []).map((m, mi) => (
                      <div key={mi} className="flex items-center gap-2">
                        <input
                          value={m.key}
                          onChange={(e) => {
                            const meta = [...(entry.meta ?? [])]
                            meta[mi] = { ...meta[mi], key: e.target.value }
                            setMeta(entry.id, meta)
                          }}
                          className="w-28 rounded border border-slate-200 px-2 py-1 text-xs"
                          placeholder="Field"
                        />
                        <input
                          value={m.value}
                          onChange={(e) => {
                            const meta = [...(entry.meta ?? [])]
                            meta[mi] = { ...meta[mi], value: e.target.value }
                            setMeta(entry.id, meta)
                          }}
                          className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
                          placeholder="Value"
                        />
                        <button
                          onClick={() => setMeta(entry.id, (entry.meta ?? []).filter((_, x) => x !== mi))}
                          className="rounded p-1 text-slate-400 hover:text-red-500"
                          aria-label="Remove field"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {(entry.meta ?? []).length < 4 && (
                      <button
                        onClick={() => setMeta(entry.id, [...(entry.meta ?? []), { key: '', value: '' }])}
                        className="text-xs font-medium text-galli hover:underline"
                      >
                        + Add field
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); addEntry() }}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-sm font-medium text-slate-500 hover:border-galli hover:text-galli"
      >
        <Plus size={16} /> Add entry
      </button>
    </div>
  )
}
