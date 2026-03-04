'use client'

import { Briefcase } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicExperienceEntryElement({ element }: Props) {
  const title = element.expTitle
  const company = element.expCompany
  const location = element.expLocation
  const startDate = element.expStartDate
  const endDate = element.expCurrent ? 'Present' : element.expEndDate
  const description = element.expDescription

  if (!title && !company) return null

  return (
    <div className="rounded-xl border border-border/50 bg-white overflow-hidden">
      <div className="flex">
        {/* Violet left accent */}
        <div className="w-1 bg-[#6C63FF] flex-shrink-0" />

        <div className="p-4 flex-1">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#6C63FF]/10 text-[#6C63FF] mt-0.5 flex-shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              {title && <div className="font-semibold text-foreground text-lg">{title}</div>}
              {company && <div className="text-foreground/70">{company}</div>}

              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {(startDate || endDate) && (
                  <span className="text-sm text-muted-foreground">
                    {startDate}{startDate && endDate ? ' — ' : ''}{endDate}
                  </span>
                )}
                {location && (
                  <span className="text-sm text-muted-foreground">
                    · {location}
                  </span>
                )}
              </div>

              {description && (
                <div className="mt-3 text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                  {description}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
