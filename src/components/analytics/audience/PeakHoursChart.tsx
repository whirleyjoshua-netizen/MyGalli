'use client'

import { Clock } from 'lucide-react'
import { peakHours } from '@/lib/data-audience'
import { DataIllustration } from '@/components/analytics/DataIllustration'

function formatHour(hour: number): string {
  if (hour === 0) return '12am'
  if (hour === 12) return '12pm'
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

export function PeakHoursChart({ hourCountsUtc }: { hourCountsUtc: number[] }) {
  // Drawn in the viewer's own timezone: "most active at 6pm" is only actionable
  // if 6pm means 6pm where the owner is.
  const local = peakHours(hourCountsUtc, new Date().getTimezoneOffset())
  const total = local.reduce((sum, n) => sum + n, 0)
  const max = Math.max(...local, 1)
  const peak = local.indexOf(Math.max(...local))

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-1 flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Peak Hours</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Shown in your time</p>

      {total === 0 ? (
        <div className="py-8 text-center">
          <DataIllustration variant="activity" />
          <p className="mt-3 text-sm font-medium">No traffic yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once visits come in, the hours your audience is most active appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex h-32 items-end gap-1">
            {local.map((count, hour) => (
              <div
                key={hour}
                data-hour={hour}
                title={`${formatHour(hour)} — ${count}`}
                className={`flex-1 rounded-t ${hour === peak ? 'bg-galli' : 'bg-galli/30'}`}
                style={{ height: `${Math.max((count / max) * 100, 2)}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
          </div>
          <p className="mt-3 text-sm">
            <span className="font-semibold text-galli">Peak</span>{' '}
            <span className="text-muted-foreground">around {formatHour(peak)}</span>
          </p>
        </>
      )}
    </div>
  )
}
