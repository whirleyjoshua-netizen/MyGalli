'use client'

import { Link2 } from 'lucide-react'
import { DataIllustration } from '@/components/analytics/DataIllustration'

const SEGMENT_COLORS = ['#39D98A', '#1FB6FF', '#6C63FF', '#F59E0B', '#F43F5E']
const RADIUS = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ReferrerDonut({
  referrers,
  totalViews,
}: {
  referrers: { domain: string; count: number }[]
  totalViews: number
}) {
  const top = referrers.slice(0, 5)

  let offset = 0

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Top Referrers</h3>
      </div>

      {top.length === 0 ? (
        <div className="py-6 text-center">
          <DataIllustration variant="referrer" />
          <p className="mt-3 text-sm font-medium">No referrers yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Share your page to see where visitors come from.</p>
        </div>
      ) : (
        <>
          <div className="relative mx-auto h-32 w-32">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              {top.map((referrer, index) => {
                const fraction = totalViews > 0 ? referrer.count / totalViews : 0
                const dash = CIRCUMFERENCE * fraction
                const circle = (
                  <circle
                    key={referrer.domain}
                    cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="14"
                    stroke={SEGMENT_COLORS[index % SEGMENT_COLORS.length]}
                    strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                    strokeDashoffset={-offset}
                  />
                )
                offset += dash
                return circle
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold">{totalViews.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground">Total Views</span>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {top.map((referrer, index) => (
              <li key={referrer.domain} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{referrer.domain}</span>
                <span className="shrink-0 font-medium">
                  {totalViews > 0 ? Math.round((referrer.count / totalViews) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
