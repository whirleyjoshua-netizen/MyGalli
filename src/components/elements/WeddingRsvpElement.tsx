'use client'

import { useState } from 'react'
import { Trash2, Plus, X, Heart, Calendar, Eye } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const defaultFields = {
  attending: true,
  plusOne: false,
  mealOptions: ['Chicken', 'Fish', 'Vegetarian'],
  dietaryField: false,
  songRequest: false,
}

export function WeddingRsvpElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const [showPreview, setShowPreview] = useState(false)
  const [newMealOption, setNewMealOption] = useState('')

  const title = element.weddingRsvpTitle || 'RSVP'
  const deadline = element.weddingRsvpDeadline || ''
  const fields = element.weddingRsvpFields || defaultFields

  const updateFields = (updates: Partial<typeof fields>) => {
    onChange({ weddingRsvpFields: { ...fields, ...updates } })
  }

  const addMealOption = () => {
    const trimmed = newMealOption.trim()
    if (!trimmed) return
    const current = fields.mealOptions || []
    if (current.includes(trimmed)) return
    updateFields({ mealOptions: [...current, trimmed] })
    setNewMealOption('')
  }

  const removeMealOption = (index: number) => {
    const current = fields.mealOptions || []
    updateFields({ mealOptions: current.filter((_, i) => i !== index) })
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
          <Heart className="w-5 h-5" style={{ color: '#E8B4B8' }} />
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Wedding RSVP</span>
        </div>

        {/* Title Input */}
        <div className="mb-4">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => onChange({ weddingRsvpTitle: e.target.value })}
            placeholder="RSVP"
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:border-[#E8B4B8] transition"
          />
        </div>

        {/* Deadline Input */}
        <div className="mb-5">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              RSVP Deadline
            </span>
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => onChange({ weddingRsvpDeadline: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:border-[#E8B4B8] transition"
          />
        </div>

        {/* Divider */}
        <div className="border-t border-border mb-5" />

        {/* Toggle Fields */}
        <div className="space-y-3 mb-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Form Fields</h3>

          <ToggleSwitch
            label="Attending (Yes / No)"
            checked={fields.attending}
            onChange={(val) => updateFields({ attending: val })}
          />
          <ToggleSwitch
            label="Plus One"
            checked={fields.plusOne}
            onChange={(val) => updateFields({ plusOne: val })}
          />
          <ToggleSwitch
            label="Dietary Restrictions"
            checked={fields.dietaryField}
            onChange={(val) => updateFields({ dietaryField: val })}
          />
          <ToggleSwitch
            label="Song Request"
            checked={fields.songRequest}
            onChange={(val) => updateFields({ songRequest: val })}
          />
        </div>

        {/* Meal Options */}
        <div className="mb-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Meal Options</h3>
          <div className="space-y-2">
            {(fields.mealOptions || []).map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="flex-1 px-3 py-1.5 rounded-lg bg-muted/50 text-sm">{option}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeMealOption(index) }}
                  className="p-1 text-muted-foreground hover:text-destructive transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newMealOption}
                onChange={(e) => setNewMealOption(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMealOption() } }}
                placeholder="Add meal option..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-dashed border-border bg-transparent text-sm outline-none focus:border-[#E8B4B8] transition"
              />
              <button
                onClick={(e) => { e.stopPropagation(); addMealOption() }}
                disabled={!newMealOption.trim()}
                className="p-1.5 rounded-lg bg-[#E8B4B8]/10 text-[#E8B4B8] hover:bg-[#E8B4B8]/20 transition disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <>
            <div className="border-t border-border mb-4" />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Preview</div>
            <div className="rounded-xl border border-[#E8B4B8]/30 bg-[#E8B4B8]/5 p-5">
              <h3 className="text-lg font-semibold text-center mb-1" style={{ color: '#C49A9E' }}>{title}</h3>
              {deadline && (
                <p className="text-xs text-center text-muted-foreground mb-4">
                  Please respond by {new Date(deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              <div className="space-y-3">
                {/* Guest Name */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Guest Name *</label>
                  <div className="w-full h-9 rounded-xl border border-[#E8B4B8]/30 bg-white/50" />
                </div>
                {/* Attending */}
                {fields.attending && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Will you be attending?</label>
                    <div className="flex gap-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full border-2 border-[#E8B4B8]/40" />
                        <span className="text-sm">Joyfully Accept</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full border-2 border-[#E8B4B8]/40" />
                        <span className="text-sm">Regretfully Decline</span>
                      </div>
                    </div>
                  </div>
                )}
                {/* Meal */}
                {(fields.mealOptions || []).length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Meal Selection</label>
                    <div className="space-y-1">
                      {(fields.mealOptions || []).map((opt, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full border-2 border-[#E8B4B8]/40" />
                          <span className="text-sm">{opt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Plus One */}
                {fields.plusOne && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Plus One Name</label>
                    <div className="w-full h-9 rounded-xl border border-[#E8B4B8]/30 bg-white/50" />
                  </div>
                )}
                {/* Dietary */}
                {fields.dietaryField && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Dietary Restrictions</label>
                    <div className="w-full h-9 rounded-xl border border-[#E8B4B8]/30 bg-white/50" />
                  </div>
                )}
                {/* Song Request */}
                {fields.songRequest && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Song Request</label>
                    <div className="w-full h-9 rounded-xl border border-[#E8B4B8]/30 bg-white/50" />
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-center">
                <div className="px-6 py-2 rounded-full text-sm font-medium text-white" style={{ backgroundColor: '#E8B4B8' }}>
                  Send RSVP
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ToggleSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <label
      className="flex items-center justify-between cursor-pointer"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => { e.stopPropagation(); onChange(!checked) }}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-[#E8B4B8]' : 'bg-muted-foreground/20'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </button>
    </label>
  )
}
