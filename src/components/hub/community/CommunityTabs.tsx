'use client'

import { Leaf, FolderOpen, LayoutGrid } from 'lucide-react'

export type CommunityTab = 'home' | 'files' | 'pages'

/** Anything that isn't a known tab falls back to Home. */
export function tabFromParam(raw: string | null): CommunityTab {
  if (raw === 'files') return 'files'
  if (raw === 'pages') return 'pages'
  return 'home'
}

const TABS: { key: CommunityTab; label: string; icon: React.ReactNode }[] = [
  { key: 'home', label: 'Home', icon: <Leaf className="h-4 w-4" /> },
  { key: 'files', label: 'Files', icon: <FolderOpen className="h-4 w-4" /> },
  { key: 'pages', label: 'Pages', icon: <LayoutGrid className="h-4 w-4" /> },
]

export function CommunityTabs({
  active, onSelect,
}: {
  active: CommunityTab
  onSelect: (t: CommunityTab) => void
}) {
  return (
    <div role="tablist" className="flex items-center gap-3">
      {TABS.map((t) => {
        const on = t.key === active
        return (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onSelect(t.key)}
            className={`inline-flex items-center gap-1.5 pb-1 text-sm font-medium transition-colors ${
              on
                ? 'border-b-2 border-primary text-foreground'
                : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={on ? 'text-primary' : ''}>{t.icon}</span> {t.label}
          </button>
        )
      })}
    </div>
  )
}
