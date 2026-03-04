'use client'

import { useState } from 'react'
import {
  Trash2,
  Plus,
  Clock,
  Church,
  Wine,
  UtensilsCrossed,
  Music,
  Sparkles,
  Camera,
  Heart,
  Star,
  PartyPopper,
  Car,
} from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const ICON_OPTIONS = [
  { name: 'Church', icon: Church },
  { name: 'Wine', icon: Wine },
  { name: 'UtensilsCrossed', icon: UtensilsCrossed },
  { name: 'Music', icon: Music },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Camera', icon: Camera },
  { name: 'Heart', icon: Heart },
  { name: 'Star', icon: Star },
  { name: 'PartyPopper', icon: PartyPopper },
  { name: 'Car', icon: Car },
] as const

interface TimelineEvent {
  time: string
  title: string
  description?: string
  icon?: string
}

export function WeddingTimelineElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const [openIconPicker, setOpenIconPicker] = useState<number | null>(null)

  const title = element.weddingTimelineTitle || 'Our Wedding Day'
  const events: TimelineEvent[] = element.weddingTimelineEvents || []

  const updateEvent = (index: number, field: keyof TimelineEvent, value: string) => {
    const updated = events.map((evt, i) =>
      i === index ? { ...evt, [field]: value } : evt
    )
    onChange({ weddingTimelineEvents: updated })
  }

  const addEvent = () => {
    onChange({
      weddingTimelineEvents: [
        ...events,
        { time: '', title: '', description: '', icon: 'Heart' },
      ],
    })
  }

  const removeEvent = (index: number) => {
    onChange({ weddingTimelineEvents: events.filter((_, i) => i !== index) })
  }

  const getIconComponent = (iconName?: string) => {
    const found = ICON_OPTIONS.find((opt) => opt.name === iconName)
    return found ? found.icon : Heart
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
        {/* Title */}
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5" style={{ color: '#E8B4B8' }} />
          <input
            type="text"
            value={title}
            onChange={(e) => onChange({ weddingTimelineTitle: e.target.value })}
            className="text-lg font-semibold bg-transparent border-none outline-none flex-1"
            placeholder="Our Wedding Day"
          />
        </div>

        {/* Events */}
        <div className="space-y-3">
          {events.map((evt, i) => {
            const IconComp = getIconComponent(evt.icon)

            return (
              <div
                key={i}
                className="group/event relative border border-border/50 rounded-lg p-3 hover:border-border transition"
              >
                <div className="flex items-start gap-3">
                  {/* Icon Selector */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenIconPicker(openIconPicker === i ? null : i)
                      }}
                      className="w-9 h-9 rounded-full flex items-center justify-center border border-border hover:border-primary/50 transition"
                      style={{ backgroundColor: '#E8B4B820' }}
                    >
                      <IconComp className="w-4 h-4" style={{ color: '#E8B4B8' }} />
                    </button>

                    {/* Icon Picker Dropdown */}
                    {openIconPicker === i && (
                      <div
                        className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-xl p-2 z-50 grid grid-cols-5 gap-1 w-[180px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {ICON_OPTIONS.map((opt) => {
                          const OptIcon = opt.icon
                          return (
                            <button
                              key={opt.name}
                              onClick={() => {
                                updateEvent(i, 'icon', opt.name)
                                setOpenIconPicker(null)
                              }}
                              className={`p-1.5 rounded-md transition flex items-center justify-center ${
                                evt.icon === opt.name ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted'
                              }`}
                              title={opt.name}
                            >
                              <OptIcon className="w-4 h-4" style={{ color: '#E8B4B8' }} />
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
                        value={evt.time}
                        onChange={(e) => updateEvent(i, 'time', e.target.value)}
                        placeholder="4:00 PM"
                        className="w-24 bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1.5 py-1 text-xs font-medium outline-none"
                      />
                      <input
                        type="text"
                        value={evt.title}
                        onChange={(e) => updateEvent(i, 'title', e.target.value)}
                        placeholder="Event title"
                        className="flex-1 bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1.5 py-1 text-sm font-semibold outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      value={evt.description || ''}
                      onChange={(e) => updateEvent(i, 'description', e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1.5 py-1 text-xs text-muted-foreground outline-none"
                    />
                  </div>

                  {/* Remove Button */}
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

        {/* Add Event */}
        <button
          onClick={(e) => { e.stopPropagation(); addEvent() }}
          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Event
        </button>
      </div>
    </div>
  )
}
