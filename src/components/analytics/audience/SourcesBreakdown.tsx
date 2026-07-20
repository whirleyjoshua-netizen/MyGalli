'use client'

import { Share2 } from 'lucide-react'
import { SOURCE_LABELS, type SourceCategory } from '@/lib/data-audience'
import { DataIllustration } from '@/components/analytics/DataIllustration'

const TONE: Record<SourceCategory, string> = {
  search: 'bg-galli-aqua',
  social: 'bg-galli-violet',
  direct: 'bg-galli',
  community: 'bg-amber-500',
  referral: 'bg-rose-500',
}

export function SourcesBreakdown({
  sources,
}: {
  sources: { source: SourceCategory; count: number }[]
}) {
  const total = sources.reduce((sum, row) => sum + row.count, 0)

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Share2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Traffic Sources</h3>
      </div>

      {sources.length === 0 || total === 0 ? (
        <div className="py-8 text-center">
          <DataIllustration variant="referrer" />
          <p className="mt-3 text-sm font-medium">No traffic sources yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your page to see where visitors arrive from.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sources.map((row) => {
            const share = (row.count / total) * 100
            return (
              <li key={row.source} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm">{SOURCE_LABELS[row.source]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className={`block h-full rounded-full ${TONE[row.source]}`} style={{ width: `${share}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                  {Math.round(share)}%
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
