'use client'

import { useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function ScrollRow({
  title,
  subtitle,
  icon,
  action,
  children,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 340, behavior: 'smooth' })

  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-3">
        <div className="flex items-start gap-2.5">
          {icon && <span className="mt-0.5 text-primary">{icon}</span>}
          <div>
            <h2 className="text-base font-bold text-foreground leading-tight">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button
            onClick={() => scroll(-1)}
            aria-label="Scroll left"
            className="p-1.5 rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll(1)}
            aria-label="Scroll right"
            className="p-1.5 rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div ref={ref} className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1">
        {children}
      </div>
    </section>
  )
}
