'use client'

import { useEffect, useRef, useState } from 'react'
import { Compass, Loader2, Users } from 'lucide-react'
import { ScrollRow } from '@/components/dashboard/ScrollRow'
import { ExploreRowCard } from './ExploreRowCard'
import { ExploreCategoryChips } from './ExploreCategoryChips'
import { categoryLabel } from '@/lib/categories'
import type { ExploreRowItem } from '@/lib/explore'
import { GalliTopBar } from '@/components/nav/GalliTopBar'
import { SearchBox } from '@/components/nav/SearchBox'

interface Rows {
  trending: ExploreRowItem[]
  following: ExploreRowItem[]
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
    <div className="relative min-h-screen bg-gradient-to-b from-galli-aqua/15 via-background to-background">
      {/* Decorative background frog watermark */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/gallio-frog.svg"
        alt=""
        aria-hidden
        className="pointer-events-none fixed -bottom-12 -right-12 z-0 w-[26rem] max-w-[45vw] opacity-[0.06]"
      />

      {/* Sticky header */}
      <GalliTopBar
        search={
          <SearchBox
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
          />
        }
      >
        <ExploreCategoryChips active={activeCategory} onSelect={(id) => { setActiveCategory(id); setSearch('') }} />
      </GalliTopBar>

      {/* Body — full-bleed to the page edges */}
      <div className="relative z-10 px-4 py-6 sm:px-8">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
            {initialRows.following.length > 0 && (
              <ScrollRow title="From people you follow" subtitle="Fresh pages from creators you follow." icon={<Users className="w-4 h-4" />}>
                {initialRows.following.map((item, i) => (
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
