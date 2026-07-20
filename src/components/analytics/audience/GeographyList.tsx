'use client'

import { Globe2 } from 'lucide-react'
import { countryLabel } from '@/lib/data-audience'
import { DataIllustration } from '@/components/analytics/DataIllustration'

export function GeographyList({
  geography,
  unknownCountryEvents,
}: {
  geography: { country: string; count: number }[]
  unknownCountryEvents: number
}) {
  const total = geography.reduce((sum, row) => sum + row.count, 0)

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Globe2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Geography</h3>
      </div>

      {geography.length === 0 || total === 0 ? (
        <div className="py-8 text-center">
          <DataIllustration variant="referrer" />
          <p className="mt-3 text-sm font-medium">No location data yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Visitor countries appear here as traffic comes in.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {geography.slice(0, 10).map((row) => {
              const { flag, name } = countryLabel(row.country)
              const share = (row.count / total) * 100
              return (
                <li key={row.country} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-base leading-none">{flag}</span>
                  <span className="w-32 shrink-0 truncate text-sm">{name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-galli" style={{ width: `${share}%` }} />
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                    {Math.round(share)}%
                  </span>
                </li>
              )
            })}
          </ul>

          {unknownCountryEvents > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              {unknownCountryEvents.toLocaleString()} visits couldn&apos;t be located and are not
              counted above.
            </p>
          )}
        </>
      )}
    </div>
  )
}
