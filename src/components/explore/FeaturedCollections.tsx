'use client'

import { Palette, Sparkles, GraduationCap, Store } from 'lucide-react'

// Curated editorial groupings. Each links to a real category-filtered view; the
// item count is the real per-category count (no fabricated numbers).
const COLLECTIONS: {
  title: string
  tagline: string
  category: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { title: 'Creative Spaces', tagline: 'Portfolios & art from the pond', category: 'creative', icon: Palette },
  { title: 'Inspiration Hub', tagline: 'Ideas worth following', category: 'entertainment', icon: Sparkles },
  { title: 'Learning Corner', tagline: 'Education & academics', category: 'education', icon: GraduationCap },
  { title: 'Community Picks', tagline: 'Loved across the pond', category: 'business', icon: Store },
]

export function FeaturedCollections({
  counts,
  onSelect,
}: {
  counts: Record<string, number>
  onSelect: (category: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {COLLECTIONS.map((c) => {
        const n = counts[c.category] || 0
        const Icon = c.icon
        return (
          <button
            key={c.title}
            onClick={() => onSelect(c.category)}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left shadow-soft transition hover:border-galli/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-galli/15 text-galli-dark">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{c.title}</p>
              <p className="truncate text-xs text-muted-foreground">{c.tagline}</p>
              <p className="text-xs text-muted-foreground">{n} item{n === 1 ? '' : 's'}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
