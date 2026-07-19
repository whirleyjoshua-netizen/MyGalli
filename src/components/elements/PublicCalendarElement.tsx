'use client'
import { useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'

export function monthMatrix(year: number, month: number): (string | null)[] {
  // returns 42 cells of 'YYYY-MM-DD' or null (padding)
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push(`${year}-${mm}-${dd}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const todayIso = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` }

interface Props { element: CanvasElement; displayId?: string }

export function PublicCalendarElement({ element }: Props) {
  const events = element.calendarEvents ?? []
  const init = new Date()
  const [year, setYear] = useState(init.getFullYear())
  const [month, setMonth] = useState(init.getMonth())
  const [selected, setSelected] = useState<string | null>(null)

  const byDate = (iso: string) => events.filter((e) => e.date === iso)
  const cells = monthMatrix(year, month)
  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear()); setMonth(d.getMonth()); setSelected(null)
  }
  const upcoming = [...events]
    .filter((e) => e.date >= todayIso())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  return (
    <div className="space-y-4">
      {element.calendarTitle && <h3 className="text-lg font-bold text-foreground">{element.calendarTitle}</h3>}
      {element.calendarSubtitle && <p className="text-sm text-muted-foreground">{element.calendarSubtitle}</p>}

      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => shift(-1)} className="px-2 py-1 rounded hover:bg-muted text-muted-foreground">‹</button>
          <div className="text-sm font-semibold text-foreground">{MONTHS[month]} {year}</div>
          <button onClick={() => shift(1)} className="px-2 py-1 rounded hover:bg-muted text-muted-foreground">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WD.map((w) => <div key={w} className="text-[10px] font-medium text-muted-foreground py-1">{w}</div>)}
          {cells.map((iso, i) => {
            if (!iso) return <div key={i} />
            const dayEvents = byDate(iso)
            const isToday = iso === todayIso()
            return (
              <button
                key={i}
                onClick={() => setSelected(dayEvents.length ? iso : null)}
                className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 transition
                  ${isToday ? 'ring-1 ring-[#39D98A]' : ''}
                  ${dayEvents.length ? 'bg-muted/50 hover:bg-muted font-medium text-foreground cursor-pointer' : 'text-muted-foreground'}`}
              >
                <span>{parseInt(iso.slice(-2), 10)}</span>
                {dayEvents.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: dayEvents[0].color || '#39D98A' }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selected && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">{selected}</div>
          {byDate(selected).map((e) => (
            <div key={e.id} className="text-sm">
              <span className="font-medium text-foreground" style={{ color: e.color || undefined }}>● </span>
              <span className="font-medium text-foreground">{e.title}</span>
              {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
            </div>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Upcoming</div>
          {upcoming.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color || '#39D98A' }} />
              <span className="text-muted-foreground w-24 flex-shrink-0">{e.date}</span>
              <span className="text-foreground">{e.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
