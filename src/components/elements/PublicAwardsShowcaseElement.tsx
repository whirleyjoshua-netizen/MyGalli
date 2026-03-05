'use client'

import { Award, Star, Trophy, Medal } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { LucideIcon } from 'lucide-react'

interface Props {
  element: CanvasElement
}

const ICON_MAP: Record<string, LucideIcon> = {
  Award,
  Star,
  Trophy,
  Medal,
}

export function PublicAwardsShowcaseElement({ element }: Props) {
  const title = element.awardsShowcaseTitle
  const items = element.awardsShowcaseItems ?? []

  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Award className="w-4 h-4 text-[#F59E0B]" />
          {title}
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {items.map((item, index) => {
          const IconComp = (item.icon && ICON_MAP[item.icon]) || Award

          return (
            <div
              key={index}
              className="rounded-xl border border-border bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: '#F59E0B20' }}
              >
                <IconComp className="w-5 h-5" style={{ color: '#F59E0B' }} />
              </div>

              {/* Title */}
              <h4 className="text-sm font-bold text-foreground">{item.title}</h4>

              {/* Issuer & Date */}
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                {item.issuer && <span>{item.issuer}</span>}
                {item.issuer && item.date && <span>&middot;</span>}
                {item.date && <span>{item.date}</span>}
              </div>

              {/* Description */}
              {item.description && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
