'use client'

import { useState } from 'react'
import { Trash2, Plus, X, CalendarCheck, Calendar, Eye } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function RSVPElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const [showPreview, setShowPreview] = useState(false)
  const [newItem, setNewItem] = useState('')

  const subject = element.rsvpSubject ?? "You're invited!"
  const deadline = element.rsvpDeadline ?? ''
  const plusOne = element.rsvpPlusOne ?? false
  const allowNote = element.rsvpAllowNote ?? false
  const publicList = element.rsvpPublicList ?? false
  const items = element.rsvpItems ?? []

  const addItem = () => {
    const trimmed = newItem.trim()
    if (!trimmed || items.includes(trimmed)) return
    onChange({ rsvpItems: [...items, trimmed] })
    setNewItem('')
  }

  const removeItem = (index: number) => {
    onChange({ rsvpItems: items.filter((_, i) => i !== index) })
  }

  return (
    <div
      className={`relative rounded-xl border transition-all ${
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-border/80'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      {/* Controls */}
      {isSelected && (
        <div className="absolute -top-3 right-2 flex items-center gap-1 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); setShowPreview(!showPreview) }}
            className="p-1.5 rounded-lg bg-background border border-border shadow-sm hover:bg-muted transition"
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg bg-background border border-border shadow-sm hover:bg-destructive/10 hover:text-destructive transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <CalendarCheck className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">RSVP</span>
        </div>

        {/* Subject */}
        <div className="mb-4">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Event subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => onChange({ rsvpSubject: e.target.value })}
            placeholder="You're invited!"
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary transition"
          />
        </div>

        {/* Deadline */}
        <div className="mb-5">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> RSVP by (optional)</span>
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => onChange({ rsvpDeadline: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary transition"
          />
        </div>

        <div className="border-t border-border mb-5" />

        {/* Options */}
        <div className="space-y-3 mb-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Options</h3>
          <ToggleSwitch label="Ask for +1 guests" checked={plusOne} onChange={(v) => onChange({ rsvpPlusOne: v })} />
          <ToggleSwitch label="Allow a note" checked={allowNote} onChange={(v) => onChange({ rsvpAllowNote: v })} />
          <ToggleSwitch
            label="Public guest board"
            hint="Everyone can see who's coming and who's bringing what. Off = private, data only in your analytics."
            checked={publicList}
            onChange={(v) => onChange({ rsvpPublicList: v })}
          />
        </div>

        {/* Bring list (claimable items) */}
        <div className="mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Bring list (potluck)</h3>
          <p className="text-xs text-muted-foreground mb-2">Guests can claim these items. Leave empty for a plain RSVP.</p>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="flex-1 px-3 py-1.5 rounded-lg bg-muted/50 text-sm">{item}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeItem(index) }}
                  className="p-1 text-muted-foreground hover:text-destructive transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
                placeholder="Add an item (e.g. Salad)…"
                className="flex-1 px-3 py-1.5 rounded-lg border border-dashed border-border bg-transparent text-sm outline-none focus:border-primary transition"
              />
              <button
                onClick={(e) => { e.stopPropagation(); addItem() }}
                disabled={!newItem.trim()}
                className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <>
            <div className="border-t border-border my-4" />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Preview</div>
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="text-lg font-bold text-center text-foreground mb-1">{subject}</h3>
              {deadline && (
                <p className="text-xs text-center text-muted-foreground mb-4">
                  Please respond by {new Date(deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Your name *</label>
                  <div className="w-full h-9 rounded-xl border border-border bg-background" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Will you be there?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['✅ Going', '🤔 Maybe', "❌ Can't go"].map((l) => (
                      <div key={l} className="py-1.5 rounded-lg border border-border text-center text-xs">{l}</div>
                    ))}
                  </div>
                </div>
                {plusOne && <div className="text-xs text-muted-foreground">+ guest counter</div>}
                {items.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">What can you bring?</label>
                    <div className="space-y-1">
                      {items.map((it, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded border border-muted-foreground/40" />
                          <span className="text-sm">{it}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {allowNote && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Leave a note (optional)</label>
                    <div className="w-full h-12 rounded-xl border border-border bg-background" />
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-center">
                <div className="px-6 py-2 rounded-full text-sm font-semibold text-primary-foreground bg-primary">Send RSVP</div>
              </div>
              {publicList && (
                <p className="text-[11px] text-center text-muted-foreground mt-3">Public board is on — guests will see the roster.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ToggleSwitch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={(e) => { e.stopPropagation(); onChange(!checked) }}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/20'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
        </button>
      </label>
      {hint && <p className="text-[11px] text-muted-foreground mt-1 pr-10">{hint}</p>}
    </div>
  )
}
