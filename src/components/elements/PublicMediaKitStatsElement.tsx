'use client'

import { BarChart2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicMediaKitStatsElement({ element }: Props) {
  const groups = element.mediaKitStats ?? []

  if (groups.length === 0) return null

  return (
    <div className="space-y-3">
      {element.mediaKitTitle && (
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BarChart2 className="w-4 h-4 text-[#E040FB]" />
          {element.mediaKitTitle}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {groups.map((group, gi) => (
          <div key={gi} className="rounded-xl border border-border bg-white p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {group.label}
            </h4>
            <div className="space-y-3">
              {group.items.map((item, ii) => {
                const isPercent = item.value.trim().endsWith('%')
                const numericVal = isPercent ? parseFloat(item.value) : NaN

                return (
                  <div key={ii}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{item.name}</span>
                      <span className="font-semibold text-[#E040FB]">{item.value}</span>
                    </div>
                    {isPercent && !isNaN(numericVal) && (
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#E040FB] to-[#AB47BC] transition-all"
                          style={{ width: `${Math.min(numericVal, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
