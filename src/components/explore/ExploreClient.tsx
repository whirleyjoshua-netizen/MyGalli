'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Compass, Loader2, Users, SlidersHorizontal, TrendingUp, FolderHeart, LayoutGrid, ArrowLeft } from 'lucide-react'
import { ScrollRow } from '@/components/dashboard/ScrollRow'
import { ExploreRowCard } from './ExploreRowCard'
import { TrendingCard } from './TrendingCard'
import { CreatorCard } from './CreatorCard'
import { CategoryTiles } from './CategoryTiles'
import { FeaturedCollections } from './FeaturedCollections'
import { PageHero } from '@/components/dashboard/PageHero'
import { SearchBox } from '@/components/nav/SearchBox'
import { categoryLabel } from '@/lib/categories'
import type { ExploreRowItem, TrendingItem, ExploreCreator, ExploreCommunity } from '@/lib/explore'

type Chip = 'all' | 'pages' | 'boards' | 'hubs' | 'people'
const CHIPS: { id: Chip; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pages', label: 'Pages' },
  { id: 'boards', label: 'Boards' },
  { id: 'hubs', label: 'Hubs' },
  { id: 'people', label: 'People' },
]

export function ExploreClient({
  trending,
  creators,
  categoryCounts,
  communities,
}: {
  trending: TrendingItem[]
  creators: ExploreCreator[]
  categoryCounts: Record<string, number>
  communities: ExploreCommunity[]
}) {
  const searchParams = useSearchParams()
  const [chip, setChip] = useState<Chip>('all')
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<'recent' | 'popular'>('popular')
  const [grid, setGrid] = useState<ExploreRowItem[]>([])
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A "grid" view is search, a picked category, or the Pages/Boards chips.
  const gridKind = chip === 'pages' ? 'page' : chip === 'boards' ? 'collection' : ''
  const inGrid = search.trim().length > 0 || activeCategory !== null || gridKind !== ''
  const gridTitle = search.trim()
    ? `Results for “${search.trim()}”`
    : activeCategory
      ? categoryLabel(activeCategory)
      : chip === 'boards'
        ? 'Boards'
        : 'Pages'

  useEffect(() => {
    if (!inGrid) {
      setGrid([])
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ limit: '24', sort })
    if (search.trim()) params.set('search', search.trim())
    if (activeCategory) params.set('category', activeCategory)
    if (gridKind) params.set('kind', gridKind)
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
  }, [inGrid, search, activeCategory, gridKind, sort])

  const pickChip = (c: Chip) => { setChip(c); setActiveCategory(null); setSearch('') }
  const pickCategory = (id: string) => { setActiveCategory(id); setChip('all'); setSearch('') }
  const backToAll = () => { setChip('all'); setActiveCategory(null); setSearch('') }

  return (
    <div className="relative min-h-screen">
      {/* Decorative frog watermark */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/gallio-frog.svg"
        alt=""
        aria-hidden
        className="pointer-events-none fixed -bottom-12 -right-12 z-0 w-[26rem] max-w-[45vw] opacity-[0.05]"
      />

      <PageHero
        icon={<Compass className="w-7 h-7 text-primary" />}
        title="Explore"
        subtitle="Discover pages, boards, hubs, and creators from across the pond."
        controls={
          <div className="flex items-center gap-2">
            <SearchBox value={search} onChange={setSearch} onClear={() => setSearch('')} />
            <button
              onClick={() => setSort((s) => (s === 'popular' ? 'recent' : 'popular'))}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              title="Toggle sort"
            >
              <SlidersHorizontal className="h-4 w-4" /> {sort === 'popular' ? 'Popular' : 'Recent'}
            </button>
          </div>
        }
      />

      <div className="relative z-10 px-4 pb-10 sm:px-8">
        {/* Type chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          {CHIPS.map((c) => {
            const active = chip === c.id && !activeCategory && !search.trim()
            return (
              <button
                key={c.id}
                onClick={() => pickChip(c.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  active ? 'bg-galli text-white' : 'border border-border bg-surface text-muted-foreground hover:text-foreground'
                }`}
              >
                {c.label}
              </button>
            )
          })}
        </div>

        {inGrid ? (
          <GridView title={gridTitle} loading={loading} grid={grid} onBack={backToAll} />
        ) : chip === 'hubs' ? (
          <CommunitiesGrid communities={communities} />
        ) : chip === 'people' ? (
          <PeopleGrid creators={creators} />
        ) : (
          <div className="space-y-10">
            <Section title="Featured Collections" icon={<FolderHeart className="h-4 w-4" />}>
              <FeaturedCollections counts={categoryCounts} onSelect={pickCategory} />
            </Section>

            {trending.length > 0 && (
              <ScrollRow title="Trending" subtitle="Most-viewed pages and boards." icon={<TrendingUp className="h-4 w-4" />}>
                {trending.map((item) => <TrendingCard key={item.id} item={item} />)}
              </ScrollRow>
            )}

            <Section title="Browse by Category" icon={<LayoutGrid className="h-4 w-4" />}>
              <CategoryTiles counts={categoryCounts} onSelect={pickCategory} />
            </Section>

            {creators.length > 0 && (
              <ScrollRow title="Explore Creators" subtitle="People building across the pond." icon={<Users className="h-4 w-4" />}>
                {creators.map((c) => <CreatorCard key={c.id} creator={c} />)}
              </ScrollRow>
            )}

            {trending.length === 0 && creators.length === 0 && (
              <p className="py-20 text-center text-muted-foreground">No public content yet — be the first to publish!</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
        <span className="text-primary">{icon}</span> {title}
      </h2>
      {children}
    </section>
  )
}

function GridView({ title, loading, grid, onBack }: { title: string; loading: boolean; grid: ExploreRowItem[]; onBack: () => void }) {
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Explore
        </button>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : grid.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">Nothing here yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {grid.map((item, i) => <ExploreRowCard key={item.id} item={item} index={i} size="grid" />)}
        </div>
      )}
    </>
  )
}

function PeopleGrid({ creators }: { creators: ExploreCreator[] }) {
  if (creators.length === 0) return <p className="py-20 text-center text-muted-foreground">No creators to show yet.</p>
  return (
    <div className="flex flex-wrap gap-4">
      {creators.map((c) => <CreatorCard key={c.id} creator={c} />)}
    </div>
  )
}

function CommunitiesGrid({ communities }: { communities: ExploreCommunity[] }) {
  if (communities.length === 0) return <p className="py-20 text-center text-muted-foreground">No public communities yet.</p>
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {communities.map((h) => (
        <Link
          key={h.id}
          href={`/${h.user.username}/hub/${h.slug}`}
          className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition hover:border-galli/40"
        >
          <div className="h-28 w-full overflow-hidden bg-gradient-to-br from-galli/25 to-galli-violet/20">
            {h.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={h.coverImage} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="p-3">
            <p className="truncate font-bold">{h.title}</p>
            <p className="truncate text-xs text-muted-foreground">by @{h.user.username}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> {h.memberCount} member{h.memberCount === 1 ? '' : 's'}
            </p>
          </div>
        </Link>
      ))}
    </div>
  )
}
