'use client'

import { GraduationCap, TrendingUp } from 'lucide-react'

interface PublicGPACardElementProps {
  element: {
    id: string
    gpaValue?: string
    gpaScale?: '4.0' | '5.0' | '100'
    gpaWeighted?: boolean
    gpaLabel?: string
    gpaTrend?: string
    gpaHonors?: string
  }
}

export function PublicGPACardElement({ element }: PublicGPACardElementProps) {
  if (!element.gpaValue) return null

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Violet top gradient bar */}
      <div className="h-1.5 bg-gradient-to-r from-[#6C63FF] to-[#8B83FF]" />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-5 h-5 text-[#6C63FF]" />
          <span className="text-sm font-semibold text-[#6C63FF]">GPA</span>
        </div>

        {/* GPA Value + Scale */}
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold text-[#6C63FF]">
            {element.gpaValue}
          </span>
          {element.gpaScale && (
            <span className="inline-flex items-center rounded-full bg-[#6C63FF]/10 px-2.5 py-0.5 text-sm font-medium text-[#6C63FF]">
              / {element.gpaScale}
            </span>
          )}
          {element.gpaWeighted && (
            <span className="inline-flex items-center rounded-full bg-[#6C63FF]/10 px-2.5 py-0.5 text-xs font-medium text-[#6C63FF]">
              Weighted
            </span>
          )}
        </div>

        {/* Label */}
        {element.gpaLabel && (
          <p className="mt-2 text-sm text-muted-foreground">
            {element.gpaLabel}
          </p>
        )}

        {/* Trend + Honors row */}
        {(element.gpaTrend || element.gpaHonors) && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {element.gpaTrend && (
              <div className="flex items-center gap-1.5 text-sm text-[#6C63FF]">
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">{element.gpaTrend}</span>
              </div>
            )}
            {element.gpaHonors && (
              <span className="inline-flex items-center rounded-full bg-[#6C63FF]/15 px-3 py-1 text-xs font-semibold text-[#6C63FF]">
                {element.gpaHonors}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
