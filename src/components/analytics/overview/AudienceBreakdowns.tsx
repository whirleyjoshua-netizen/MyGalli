'use client'

import { Monitor, Globe } from 'lucide-react'
import { DataIllustration } from '@/components/analytics/DataIllustration'

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function BreakdownCard({
  title,
  icon: Icon,
  data,
  emptyVariant,
  emptyHeading,
  emptyCopy,
}: {
  title: string
  icon: typeof Monitor
  data: Record<string, number>
  emptyVariant: 'device' | 'browser'
  emptyHeading: string
  emptyCopy: string
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, count]) => sum + count, 0)

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">{title}</h3>
      </div>

      {entries.length === 0 || total === 0 ? (
        <div className="py-8 text-center">
          <DataIllustration variant={emptyVariant} />
          <p className="mt-3 text-sm font-medium">{emptyHeading}</p>
          <p className="mt-1 text-sm text-muted-foreground">{emptyCopy}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map(([key, count]) => {
            const pct = Math.round((count / total) * 100)
            return (
              <li key={key} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm">{capitalize(key)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-galli"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">{pct}%</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function AudienceBreakdowns({
  devices,
  browsers,
}: {
  devices: Record<string, number>
  browsers: Record<string, number>
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <BreakdownCard
        title="Devices"
        icon={Monitor}
        data={devices}
        emptyVariant="device"
        emptyHeading="No device data yet"
        emptyCopy="Once visitors arrive, their device types will show up here."
      />
      <BreakdownCard
        title="Browsers"
        icon={Globe}
        data={browsers}
        emptyVariant="browser"
        emptyHeading="No browser data yet"
        emptyCopy="Once visitors arrive, their browsers will show up here."
      />
    </div>
  )
}
