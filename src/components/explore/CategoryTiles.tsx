'use client'

import { Trophy, Palette, Briefcase, Store, User, PartyPopper, GraduationCap, Sparkles } from 'lucide-react'
import { CATEGORIES } from '@/lib/categories'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Trophy, Palette, Briefcase, Store, User, PartyPopper, GraduationCap, Sparkles,
}

export function CategoryTiles({
  counts,
  onSelect,
}: {
  counts: Record<string, number>
  onSelect: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {CATEGORIES.map((c) => {
        const Icon = ICONS[c.icon] || Sparkles
        const n = counts[c.id] || 0
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left shadow-soft transition hover:border-galli/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-galli/15 text-galli-dark">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{c.label}</p>
              <p className="text-xs text-muted-foreground">{n} item{n === 1 ? '' : 's'}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
