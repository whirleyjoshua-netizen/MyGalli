'use client'

import { GraduationCap } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicEducationEntryElement({ element }: Props) {
  const institution = element.eduInstitution
  const degree = element.eduDegree
  const field = element.eduField
  const gpa = element.eduGpa
  const startDate = element.eduStartDate
  const endDate = element.eduEndDate
  const honors = element.eduHonors
  const description = element.eduDescription

  if (!institution && !degree) return null

  const degreeLine = [degree, field].filter(Boolean).join(' in ')

  return (
    <div className="rounded-xl border border-border/50 bg-white overflow-hidden">
      <div className="flex">
        <div className="w-1 bg-[#6C63FF] flex-shrink-0" />

        <div className="p-4 flex-1">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#6C63FF]/10 text-[#6C63FF] mt-0.5 flex-shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              {institution && <div className="font-semibold text-foreground text-lg">{institution}</div>}
              {degreeLine && <div className="text-foreground/70">{degreeLine}</div>}

              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {(startDate || endDate) && (
                  <span className="text-sm text-muted-foreground">
                    {startDate}{startDate && endDate ? ' — ' : ''}{endDate}
                  </span>
                )}
                {gpa && (
                  <span className="px-2 py-0.5 bg-[#6C63FF]/10 text-[#6C63FF] rounded-full text-xs font-medium">
                    GPA: {gpa}
                  </span>
                )}
                {honors && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                    {honors}
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
