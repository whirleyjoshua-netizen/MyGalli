'use client'

import { Trash2, Clock, MapPin, Phone, Mail, Globe, ExternalLink } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function BusinessHoursElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const schedule = element.bizHoursSchedule ?? []

  const updateDay = (index: number, field: string, value: any) => {
    const updated = [...schedule]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ bizHoursSchedule: updated })
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-amber-500 border-amber-500/30' : 'border-border hover:border-amber-500/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <input
            type="text"
            value={element.bizHoursTitle ?? 'Hours & Location'}
            onChange={(e) => onChange({ bizHoursTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold bg-transparent border-none outline-none"
          />
        </div>

        {/* Schedule */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Hours</div>
          {schedule.map((day, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <span className="w-20 font-medium text-foreground">{day.day}</span>
              <label className="flex items-center gap-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={day.closed}
                  onChange={(e) => updateDay(index, 'closed', e.target.checked)}
                  className="accent-amber-500"
                />
                <span className="text-muted-foreground">Closed</span>
              </label>
              {!day.closed && (
                <>
                  <input
                    type="text"
                    value={day.open}
                    onChange={(e) => updateDay(index, 'open', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="9:00 AM"
                    className="w-20 bg-transparent border border-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-amber-500 text-[10px]"
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="text"
                    value={day.close}
                    onChange={(e) => updateDay(index, 'close', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="5:00 PM"
                    className="w-20 bg-transparent border border-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-amber-500 text-[10px]"
                  />
                </>
              )}
            </div>
          ))}
        </div>

        {/* Special note */}
        <input
          type="text"
          value={element.bizHoursSpecialNote ?? ''}
          onChange={(e) => onChange({ bizHoursSpecialNote: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Special hours note (e.g., Holiday hours may vary)"
          className="w-full text-[10px] bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
        />

        {/* Contact fields */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contact Info</div>
          {[
            { key: 'bizHoursAddress' as const, icon: MapPin, placeholder: '123 Main St, City, State' },
            { key: 'bizHoursPhone' as const, icon: Phone, placeholder: '(555) 123-4567' },
            { key: 'bizHoursEmail' as const, icon: Mail, placeholder: 'hello@business.com' },
            { key: 'bizHoursWebsite' as const, icon: Globe, placeholder: 'https://yourbusiness.com' },
            { key: 'bizHoursMapsUrl' as const, icon: ExternalLink, placeholder: 'Google Maps link' },
          ].map(({ key, icon: Icon, placeholder }) => (
            <div key={key} className="flex items-center gap-2">
              <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={(element[key] as string) ?? ''}
                onChange={(e) => onChange({ [key]: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder={placeholder}
                className="flex-1 text-[10px] bg-transparent border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          ))}
        </div>
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
