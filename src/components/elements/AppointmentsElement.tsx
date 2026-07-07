'use client'
import Link from 'next/link'
import { Trash2, CalendarClock, Lock } from 'lucide-react'
import type { CanvasElement, ApptRule } from '@/lib/types/canvas'
import { isPro } from '@/lib/plan'
import { useAuthStore } from '@/lib/store'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function AppointmentsElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const { user } = useAuthStore()
  const pro = isPro(user)
  const rules = element.apptWeeklyRules ?? []

  const setRuleForDay = (day: number, enabled: boolean) => {
    if (enabled) onChange({ apptWeeklyRules: [...rules, { day, start: '09:00', end: '17:00' }] })
    else onChange({ apptWeeklyRules: rules.filter((r) => r.day !== day) })
  }
  const updateRule = (day: number, patch: Partial<ApptRule>) =>
    onChange({ apptWeeklyRules: rules.map((r) => (r.day === day ? { ...r, ...patch } : r)) })

  if (!pro) {
    return (
      <div className={`relative rounded-xl border-2 border-dashed border-[#6C63FF]/40 bg-[#6C63FF]/5 p-6 text-center ${isSelected ? 'ring-2 ring-[#6C63FF]' : ''}`}
        onClick={(e) => { e.stopPropagation(); onSelect() }}>
        <Lock className="w-6 h-6 text-[#6C63FF] mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground">Appointments is a Pro feature</p>
        <p className="text-xs text-muted-foreground mt-1">Upgrade to let visitors book time with you.</p>
        <Link href="/enterprise" className="inline-block mt-3 text-xs font-semibold text-[#6C63FF] underline">Upgrade to Pro</Link>
        {isSelected && (
          <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`relative rounded-xl border bg-background transition-all ${isSelected ? 'ring-2 ring-[#39D98A] border-[#39D98A]/30' : 'border-border'}`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}>
      <div className="p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[#39D98A]" />
          <input value={element.apptTitle ?? ''} placeholder="Meeting title"
            onChange={(e) => onChange({ apptTitle: e.target.value })}
            className="text-sm font-semibold bg-transparent outline-none flex-1" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1"><span className="text-muted-foreground">Duration (min)</span>
            <input type="number" value={element.apptDuration ?? 30} onChange={(e) => onChange({ apptDuration: parseInt(e.target.value) || 30 })}
              className="w-full border border-border rounded px-2 py-1 bg-transparent" /></label>
          <label className="space-y-1"><span className="text-muted-foreground">Buffer (min)</span>
            <input type="number" value={element.apptBuffer ?? 0} onChange={(e) => onChange({ apptBuffer: parseInt(e.target.value) || 0 })}
              className="w-full border border-border rounded px-2 py-1 bg-transparent" /></label>
          <label className="space-y-1"><span className="text-muted-foreground">Min notice (hrs)</span>
            <input type="number" value={element.apptLeadTimeHours ?? 12} onChange={(e) => onChange({ apptLeadTimeHours: parseInt(e.target.value) || 0 })}
              className="w-full border border-border rounded px-2 py-1 bg-transparent" /></label>
          <label className="space-y-1"><span className="text-muted-foreground">Book up to (days)</span>
            <input type="number" value={element.apptMaxDaysAhead ?? 30} onChange={(e) => onChange({ apptMaxDaysAhead: parseInt(e.target.value) || 30 })}
              className="w-full border border-border rounded px-2 py-1 bg-transparent" /></label>
        </div>

        <label className="block text-xs space-y-1">
          <span className="text-muted-foreground">Timezone (IANA)</span>
          <input value={element.apptTimezone ?? ''} placeholder="America/New_York"
            onChange={(e) => onChange({ apptTimezone: e.target.value })}
            className="w-full border border-border rounded px-2 py-1 bg-transparent" />
        </label>

        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase">Weekly availability</div>
          {DAYS.map((label, day) => {
            const rule = rules.find((r) => r.day === day)
            return (
              <div key={day} className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1 w-16">
                  <input type="checkbox" checked={!!rule} onChange={(e) => setRuleForDay(day, e.target.checked)} className="accent-[#39D98A]" />
                  <span>{label}</span>
                </label>
                {rule && (
                  <>
                    <input type="time" value={rule.start} onChange={(e) => updateRule(day, { start: e.target.value })} className="border border-border rounded px-1 py-0.5 bg-transparent" />
                    <span>–</span>
                    <input type="time" value={rule.end} onChange={(e) => updateRule(day, { end: e.target.value })} className="border border-border rounded px-1 py-0.5 bg-transparent" />
                  </>
                )}
              </div>
            )
          })}
        </div>

        <label className="block text-xs space-y-1">
          <span className="text-muted-foreground">Location / details</span>
          <input value={element.apptLocationDetail ?? ''} placeholder="Zoom link sent after booking, address, etc."
            onChange={(e) => onChange({ apptLocationDetail: e.target.value })}
            className="w-full border border-border rounded px-2 py-1 bg-transparent" />
        </label>

        <div className="border-t border-border pt-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Upcoming bookings</div>
          <p className="text-[10px] text-muted-foreground">Bookings appear here once your page is published and visitors book.</p>
        </div>
      </div>

      {isSelected && (
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
