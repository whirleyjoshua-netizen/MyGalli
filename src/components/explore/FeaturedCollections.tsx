'use client'

import { Palette, Sparkles, GraduationCap, Store } from 'lucide-react'

// Curated editorial groupings. Each links to a real category-filtered view; the
// item count is the real per-category count (no fabricated numbers).
const COLLECTIONS: {
  title: string
  tagline: string
  category: string
  gradient: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { title: 'Creative Spaces', tagline: 'Portfolios & art from the pond', category: 'creative', gradient: 'from-galli/40 to-galli-aqua/25', icon: Palette },
  { title: 'Inspiration Hub', tagline: 'Ideas worth following', category: 'entertainment', gradient: 'from-galli-violet/40 to-galli-aqua/25', icon: Sparkles },
  { title: 'Learning Corner', tagline: 'Education & academics', category: 'education', gradient: 'from-galli-aqua/40 to-galli/25', icon: GraduationCap },
  { title: 'Community Picks', tagline: 'Loved across the pond', category: 'business', gradient: 'from-galli/35 to-galli-violet/30', icon: Store },
]

export function FeaturedCollections({
  counts,
  onSelect,
}: {
  counts: Record<string, number>
  onSelect: (category: string) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {COLLECTIONS.map((c) => {
        const n = counts[c.category] || 0
        const Icon = c.icon
        return (
          <button
            key={c.title}
            onClick={() => onSelect(c.category)}
            className={`group relative flex h-40 flex-col justify-end overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${c.gradient} p-4 text-left shadow-soft`}
          >
            <Icon className="absolute right-3 top-3 h-8 w-8 text-galli-dark/40" />
            <p className="text-lg font-extrabold text-galli-dark">{c.title}</p>
            <p className="text-sm text-galli-dark/70">{c.tagline}</p>
            <p className="mt-1 text-xs font-semibold text-galli-dark/60">{n} item{n === 1 ? '' : 's'}</p>
          </button>
        )
      })}
    </div>
  )
}
