'use client'

import { Trophy, Palette, Briefcase, Store, User, PartyPopper, GraduationCap, Sparkles, LayoutGrid } from 'lucide-react'
import { CATEGORIES } from '@/lib/categories'

const ICONS: Record<string, typeof Trophy> = {
  Trophy, Palette, Briefcase, Store, User, PartyPopper, GraduationCap, Sparkles,
}

export function ExploreCategoryChips({
  active,
  onSelect,
}: {
  active: string | null
  onSelect: (id: string | null) => void
}) {
  const chip = (selected: boolean) =>
    `inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer border ${
      selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface text-muted-foreground border-border hover:bg-muted'
    }`
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
      <button onClick={() => onSelect(null)} className={chip(active === null)}>
        <LayoutGrid className="w-4 h-4" /> All
      </button>
      {CATEGORIES.map((c) => {
        const Icon = ICONS[c.icon] ?? Sparkles
        return (
          <button key={c.id} onClick={() => onSelect(c.id)} className={chip(active === c.id)}>
            <Icon className="w-4 h-4" /> {c.label}
          </button>
        )
      })}
    </div>
  )
}
