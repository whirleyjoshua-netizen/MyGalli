'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, Compass, Loader2 } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'
import { ScrollRow } from '@/components/dashboard/ScrollRow'
import { ExploreRowCard } from './ExploreRowCard'
import { ExploreCategoryChips } from './ExploreCategoryChips'
import { categoryLabel } from '@/lib/categories'
import type { ExploreRowItem } from '@/lib/explore'

interface Rows {
  trending: ExploreRowItem[]
  categories: { id: string; label: string; displays: ExploreRowItem[] }[]
}

export function ExploreClient({ initialRows }: { initialRows: Rows }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [grid, setGrid] = useState<ExploreRowItem[]>([])
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const inGridMode = activeCategory !== null || search.trim().length > 0

  useEffect(() => {
    if (!inGridMode) {
      setGrid([])
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ limit: '24' })
    if (activeCategory) params.set('category', activeCategory)
    if (search.trim()) params.set('search', search.trim())
    const run = () =>
      fetch(`/api/explore?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : { displays: [] }))
        .then((d) => setGrid(Array.isArray(d.displays) ? d.displays : []))
        .catch(() => setGrid([]))
        .finally(() => setLoading(false))
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(run, search.trim() ? 300 : 0)
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [activeCategory, search, inGridMode])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-surface/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <a href="/dashboard" className="text-xl">
            <Wordmark />
          </a>
          <div className="flex-1 flex items-center gap-2 px-3.5 h-10 rounded-full border border-border bg-surface max-w-md">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Galli pages…"
              aria-label="Search"
              className="bg-transparent outline-none text-sm w-full"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-2">
          <ExploreCategoryChips active={activeCategory} onSelect={(id) => { setActiveCategory(id); setSearch('') }} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {inGridMode ? (
          <>
            <h2 className="text-lg font-bold mb-4">
              {search.trim() ? `Results for "${search.trim()}"` : categoryLabel(activeCategory!)}
            </h2>
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : grid.length === 0 ? (
              <p className="text-center text-muted-foreground py-20">No pages found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {grid.map((item, i) => (
                  <ExploreRowCard key={item.id} item={item} index={i} size="grid" />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {initialRows.trending.length > 0 && (
              <ScrollRow title="Trending" subtitle="Most-viewed pages right now." icon={<Compass className="w-4 h-4" />}>
                {initialRows.trending.map((item, i) => (
                  <ExploreRowCard key={item.id} item={item} index={i} />
                ))}
              </ScrollRow>
            )}
            {initialRows.categories.map((cat) => (
              <ScrollRow
                key={cat.id}
                title={cat.label}
                action={
                  <button onClick={() => setActiveCategory(cat.id)} className="text-xs font-medium text-primary hover:underline cursor-pointer mr-1">
                    See all
                  </button>
                }
              >
                {cat.displays.map((item, i) => (
                  <ExploreRowCard key={item.id} item={item} index={i} />
                ))}
              </ScrollRow>
            ))}
            {initialRows.trending.length === 0 && initialRows.categories.length === 0 && (
              <p className="text-center text-muted-foreground py-20">No public pages yet — be the first to publish one!</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
