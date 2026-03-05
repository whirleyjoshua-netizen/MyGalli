'use client'

import { useState } from 'react'
import {
  Trash2,
  Plus,
  Clock,
  MapPin,
  Plane,
  GraduationCap,
  Trophy,
  Star,
  Flag,
  Camera,
  Heart,
  Zap,
  Sun,
  Mountain,
  Code,
  Music,
  Briefcase,
  Rocket,
  ChevronDown,
  Image as ImageIcon,
} from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { LucideIcon } from 'lucide-react'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: 'MapPin', icon: MapPin },
  { name: 'Plane', icon: Plane },
  { name: 'GraduationCap', icon: GraduationCap },
  { name: 'Trophy', icon: Trophy },
  { name: 'Star', icon: Star },
  { name: 'Flag', icon: Flag },
  { name: 'Camera', icon: Camera },
  { name: 'Heart', icon: Heart },
  { name: 'Zap', icon: Zap },
  { name: 'Sun', icon: Sun },
  { name: 'Mountain', icon: Mountain },
  { name: 'Code', icon: Code },
  { name: 'Music', icon: Music },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Rocket', icon: Rocket },
]

const PRESET_COLORS = [
  '#39D98A', // Gallio green
  '#6C63FF', // Violet
  '#1FB6FF', // Aqua
  '#F59E0B', // Amber
  '#F43F5E', // Rose
  '#64748B', // Slate
  '#6366F1', // Indigo
  '#F97316', // Orange
]

interface TimelineEvent {
  date: string
  title: string
  description?: string
  icon?: string
  image?: string
  isCurrent?: boolean
}

export function TimelineElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const [openIconPicker, setOpenIconPicker] = useState<number | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [expandedDesc, setExpandedDesc] = useState<Set<number>>(new Set())

  const title = element.timelineTitle || 'My Timeline'
  const color = element.timelineColor || '#39D98A'
  const events: TimelineEvent[] = element.timelineEvents || []

  const updateEvent = (index: number, updates: Partial<TimelineEvent>) => {
    const updated = events.map((evt, i) =>
      i === index ? { ...evt, ...updates } : evt
    )
    onChange({ timelineEvents: updated })
  }

  const addEvent = () => {
    onChange({
      timelineEvents: [
        ...events,
        { date: '', title: '', description: '', icon: 'Star', isCurrent: false },
      ],
    })
  }

  const removeEvent = (index: number) => {
    onChange({ timelineEvents: events.filter((_, i) => i !== index) })
  }

  const toggleDesc = (index: number) => {
    setExpandedDesc(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const getIconComponent = (iconName?: string): LucideIcon => {
    const found = ICON_OPTIONS.find((opt) => opt.name === iconName)
    return found ? found.icon : Star
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
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg bg-background border border-border shadow-sm hover:bg-destructive/10 hover:text-destructive transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="p-4">
        {/* Title + Color Picker Row */}
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5" style={{ color }} />
          <input
            type="text"
            value={title}
            onChange={(e) => onChange({ timelineTitle: e.target.value })}
            className="text-lg font-semibold bg-transparent border-none outline-none flex-1"
            placeholder="My Timeline"
          />

          {/* Color Swatch */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker) }}
              className="w-7 h-7 rounded-full border-2 border-border hover:border-primary/50 transition flex-shrink-0"
              style={{ backgroundColor: color }}
              title="Accent color"
            />
            {showColorPicker && (
              <div
                className="absolute top-full right-0 mt-1 bg-background border border-border rounded-lg shadow-xl p-3 z-50 w-[220px]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { onChange({ timelineColor: c }); setShowColorPicker(false) }}
                      className={`w-8 h-8 rounded-full border-2 transition ${
                        color === c ? 'border-foreground scale-110' : 'border-transparent hover:border-border'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Hex</span>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => {
                      const v = e.target.value
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange({ timelineColor: v })
                    }}
                    className="flex-1 text-xs bg-muted border border-border rounded px-2 py-1 outline-none font-mono"
                    maxLength={7}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Muted timeline line indicator */}
        <div className="relative pl-5">
          <div
            className="absolute left-[9px] top-2 bottom-2 w-0.5 rounded-full opacity-20"
            style={{ backgroundColor: color }}
          />

          {/* Events */}
          <div className="space-y-3">
            {events.map((evt, i) => {
              const IconComp = getIconComponent(evt.icon)
              const descVisible = expandedDesc.has(i) || !!evt.description

              return (
                <div
                  key={i}
                  className="group/event relative border border-border/50 rounded-lg p-3 hover:border-border transition ml-3"
                >
                  <div className="flex items-start gap-3">
                    {/* Dot on the line */}
                    <div
                      className="absolute -left-3 top-4 w-2.5 h-2.5 rounded-full border-2"
                      style={{
                        borderColor: color,
                        backgroundColor: evt.isCurrent ? color : 'var(--background)',
                      }}
                    />

                    {/* Icon Selector */}
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenIconPicker(openIconPicker === i ? null : i)
                        }}
                        className="w-9 h-9 rounded-full flex items-center justify-center border border-border hover:border-primary/50 transition"
                        style={{ backgroundColor: `${color}15` }}
                      >
                        <IconComp className="w-4 h-4" style={{ color }} />
                      </button>

                      {openIconPicker === i && (
                        <div
                          className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-xl p-2 z-50 grid grid-cols-5 gap-1 w-[200px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {ICON_OPTIONS.map((opt) => {
                            const OptIcon = opt.icon
                            return (
                              <button
                                key={opt.name}
                                onClick={() => {
                                  updateEvent(i, { icon: opt.name })
                                  setOpenIconPicker(null)
                                }}
                                className={`p-1.5 rounded-md transition flex items-center justify-center ${
                                  evt.icon === opt.name ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted'
                                }`}
                                title={opt.name}
                              >
                                <OptIcon className="w-4 h-4" style={{ color }} />
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Fields */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={evt.date}
                          onChange={(e) => updateEvent(i, { date: e.target.value })}
                          placeholder="Jan 2025"
                          className="w-28 bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1.5 py-1 text-xs font-medium outline-none"
                        />
                        <input
                          type="text"
                          value={evt.title}
                          onChange={(e) => updateEvent(i, { title: e.target.value })}
                          placeholder="Event title"
                          className="flex-1 bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1.5 py-1 text-sm font-semibold outline-none"
                        />
                      </div>

                      {/* Description toggle */}
                      {descVisible ? (
                        <textarea
                          value={evt.description || ''}
                          onChange={(e) => updateEvent(i, { description: e.target.value })}
                          placeholder="Description (optional)"
                          rows={2}
                          className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1.5 py-1 text-xs text-muted-foreground outline-none resize-none"
                        />
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleDesc(i) }}
                          className="text-[10px] text-muted-foreground hover:text-foreground transition"
                        >
                          + Add description
                        </button>
                      )}

                      {/* Image URL */}
                      <div className="flex items-center gap-1.5">
                        <ImageIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <input
                          type="text"
                          value={evt.image || ''}
                          onChange={(e) => updateEvent(i, { image: e.target.value })}
                          placeholder="Image URL (optional)"
                          className="flex-1 bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1.5 py-1 text-[11px] text-muted-foreground outline-none"
                        />
                      </div>

                      {/* Current toggle */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={evt.isCurrent || false}
                          onChange={(e) => updateEvent(i, { isCurrent: e.target.checked })}
                          className="w-3 h-3 rounded accent-primary"
                        />
                        <span className="text-[10px] text-muted-foreground">Current</span>
                      </label>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeEvent(i) }}
                      className="p-1 opacity-0 group-hover/event:opacity-100 hover:text-destructive transition flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Add Event */}
        <button
          onClick={(e) => { e.stopPropagation(); addEvent() }}
          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition ml-8"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Event
        </button>
      </div>
    </div>
  )
}
