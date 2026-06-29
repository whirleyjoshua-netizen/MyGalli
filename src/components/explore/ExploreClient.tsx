'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, Compass, Loader2, Users, Home, User as UserIcon } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { ScrollRow } from '@/components/dashboard/ScrollRow'
import { ExploreRowCard } from './ExploreRowCard'
import { ExploreCategoryChips } from './ExploreCategoryChips'
import { categoryLabel } from '@/lib/categories'
import type { ExploreRowItem } from '@/lib/explore'

interface Rows {
  trending: ExploreRowItem[]
  following: ExploreRowItem[]
  categories: { id: string; label: string; displays: ExploreRowItem[] }[]
}

export function ExploreClient({ initialRows }: { initialRows: Rows }) {
  const { user } = useAuthStore()
  const initial = (user?.name || user?.username || '?').charAt(0).toUpperCase()
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
      <div className="sticky top-0 z-20">
        {/* Gradient bar */}
        <div className="bg-gradient-to-r from-galli via-galli-aqua to-galli-violet text-white shadow-soft-lg">
          <div className="flex items-center px-4 py-3 sm:px-8">
            {/* Left — home */}
            <div className="flex flex-1 justify-start">
              <a
                href="/dashboard"
                aria-label="Home"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              >
                <Home className="h-5 w-5" />
              </a>
            </div>

            {/* Center — brand + search */}
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 shadow-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/gallio-frog.svg" alt="" aria-hidden className="h-7 w-7" />
              </span>
              <span className="hidden text-xl font-extrabold tracking-tight text-white drop-shadow-sm sm:inline">
                My Galli
              </span>
              <div className="flex h-10 w-44 items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3.5 backdrop-blur-sm sm:w-72 md:w-80">
                <Search className="h-4 w-4 shrink-0 text-white/80" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search My Galli pages…"
                  aria-label="Search"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/70"
                />
                {search && (
                  <button onClick={() => setSearch('')} aria-label="Clear search">
                    <X className="h-4 w-4 text-white/80" />
                  </button>
                )}
              </div>
            </div>

            {/* Right — profile avatar */}
            <div className="flex flex-1 justify-end">
              {user ? (
                <a href={`/${user.username}`} aria-label="Your profile" className="shrink-0">
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar}
                      alt=""
                      className="h-9 w-9 rounded-full border-2 border-white/60 object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-galli-dark">
                      {initial}
                    </span>
                  )}
                </a>
              ) : (
                <a
                  href="/login"
                  aria-label="Log in"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                >
                  <UserIcon className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>
        </div>
        {/* Category chips sub-bar */}
        <div className="border-b border-border bg-surface/80 backdrop-blur">
          <div className="px-4 py-2 sm:px-8">
            <ExploreCategoryChips active={activeCategory} onSelect={(id) => { setActiveCategory(id); setSearch('') }} />
          </div>
        </div>
      </div>

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
