'use client'
import { useState } from 'react'
import { Trash2, Plus, Calendar as CalIcon } from 'lucide-react'
import type { CanvasElement, CalendarEvent } from '@/lib/types/canvas'
import { monthMatrix } from './PublicCalendarElement'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const SWATCHES = ['#39D98A', '#1FB6FF', '#6C63FF', '#F59E0B', '#EF4444']

export function CalendarElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const events = element.calendarEvents ?? []
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [activeDay, setActiveDay] = useState<string | null>(null)

  const shift = (d: number) => { const dt = new Date(year, month + d, 1); setYear(dt.getFullYear()); setMonth(dt.getMonth()) }
  const byDate = (iso: string) => events.filter((e) => e.date === iso)
  const newId = () => `evt-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

  const addEvent = (iso: string) => {
    const evt: CalendarEvent = { id: newId(), date: iso, title: 'New event', color: '#39D98A' }
    onChange({ calendarEvents: [...events, evt] })
    setActiveDay(iso)
  }
  const updateEvent = (id: string, patch: Partial<CalendarEvent>) =>
    onChange({ calendarEvents: events.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  const removeEvent = (id: string) => onChange({ calendarEvents: events.filter((e) => e.id !== id) })

  const cells = monthMatrix(year, month)

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${isSelected ? 'ring-2 ring-[#39D98A] border-[#39D98A]/30' : 'border-border hover:border-[#39D98A]/30'}`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalIcon className="w-4 h-4 text-[#39D98A]" />
          <input
            value={element.calendarTitle ?? ''} placeholder="Calendar title"
            onChange={(e) => onChange({ calendarTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold bg-transparent border-none outline-none flex-1"
          />
        </div>
        <input
          value={element.calendarSubtitle ?? ''} placeholder="Subtitle (optional)"
          onChange={(e) => onChange({ calendarSubtitle: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-full text-xs bg-transparent border border-border rounded px-2 py-1 outline-none"
        />

        <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => shift(-1)} className="px-2 text-muted-foreground hover:text-foreground">‹</button>
          <span className="text-xs font-semibold">{MONTHS[month]} {year}</span>
          <button onClick={() => shift(1)} className="px-2 text-muted-foreground hover:text-foreground">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center" onClick={(e) => e.stopPropagation()}>
          {WD.map((w, i) => <div key={i} className="text-[9px] text-muted-foreground">{w}</div>)}
          {cells.map((iso, i) => {
            if (!iso) return <div key={i} />
            const has = byDate(iso).length > 0
            return (
              <button key={i} onClick={() => (has ? setActiveDay(iso) : addEvent(iso))}
                className={`aspect-square rounded text-[10px] flex items-center justify-center ${has ? 'bg-[#39D98A]/15 text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted'} ${activeDay === iso ? 'ring-1 ring-[#39D98A]' : ''}`}>
                {parseInt(iso.slice(-2), 10)}
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-muted-foreground">Tap a day to add an event.</p>

        {activeDay && (
          <div className="space-y-2 border-t border-border pt-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground">{activeDay}</span>
              <button onClick={() => addEvent(activeDay)} className="text-[10px] text-[#39D98A] flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>
            </div>
            {byDate(activeDay).map((e) => (
              <div key={e.id} className="space-y-1 border border-border rounded p-2">
                <div className="flex items-center gap-1">
                  <input value={e.title} onChange={(ev) => updateEvent(e.id, { title: ev.target.value })}
                    className="flex-1 text-xs bg-transparent border-b border-border outline-none" />
                  <button onClick={() => removeEvent(e.id)}><Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" /></button>
                </div>
                <input value={e.note ?? ''} placeholder="Note (optional)" onChange={(ev) => updateEvent(e.id, { note: ev.target.value })}
                  className="w-full text-[10px] bg-transparent border border-border rounded px-1.5 py-0.5 outline-none" />
                <div className="flex gap-1">
                  {SWATCHES.map((c) => (
                    <button key={c} onClick={() => updateEvent(e.id, { color: c })}
                      className={`w-4 h-4 rounded-full ${e.color === c ? 'ring-2 ring-offset-1 ring-foreground' : ''}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isSelected && (
        <button onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
