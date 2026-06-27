'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Search, X, Compass, ChevronDown, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { ExploreCard } from './ExploreCard'
import { ExploreCardSkeleton } from './ExploreCardSkeleton'

type KitFilter = 'all' | 'athlete' | 'resume' | 'custom'
type SortMode = 'recent' | 'popular' | 'updated'

interface ExploreDisplay {
  id: string
  slug: string
  title: string
  description: string | null
  views: number
  createdAt: string
  updatedAt: string
  kitConfig: unknown
  headerCard: unknown
  background: unknown
  user: { username: string; name: string | null; avatar: string | null }
}

interface ExploreClientProps {
  initialDisplays: ExploreDisplay[]
  initialTotal: number
  pageSize: number
}

const KIT_FILTERS: { value: KitFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'athlete', label: 'Athlete Kit' },
  { value: 'resume', label: 'Resume Kit' },
  { value: 'custom', label: 'Custom' },
]

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'updated', label: 'Recently Updated' },
]

export function ExploreClient({ initialDisplays, initialTotal, pageSize }: ExploreClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const isInitialMount = useRef(true)

  const [kit, setKit] = useState<KitFilter>(
    (searchParams.get('kit') as KitFilter) || 'all'
  )
  const [sort, setSort] = useState<SortMode>(
    (searchParams.get('sort') as SortMode) || 'recent'
  )
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [page, setPage] = useState(1)
  const [displays, setDisplays] = useState<ExploreDisplay[]>(initialDisplays)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const hasMore = page * pageSize < total

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch displays from API
  const fetchDisplays = useCallback(async (opts: {
    kit: string
    sort: string
    search: string
    page: number
    append: boolean
  }) => {
    const params = new URLSearchParams({
      kit: opts.kit,
      sort: opts.sort,
      page: String(opts.page),
      limit: String(pageSize),
    })
    if (opts.search) params.set('search', opts.search)

    if (opts.append) setLoadingMore(true)
    else setLoading(true)

    try {
      const res = await fetch(`/api/explore?${params}`)
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()

      if (opts.append) {
        setDisplays(prev => [...prev, ...data.displays])
      } else {
        setDisplays(data.displays)
      }
      setTotal(data.total)
      setPage(opts.page)
    } catch (err) {
      console.error('Explore fetch error:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [pageSize])

  // Re-fetch when filters change (skip initial mount — SSR data is already loaded)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    fetchDisplays({ kit, sort, search: debouncedSearch, page: 1, append: false })
  }, [kit, sort, debouncedSearch, fetchDisplays])

  // Sync URL params
  useEffect(() => {
    if (isInitialMount.current) return
    const params = new URLSearchParams()
    if (kit !== 'all') params.set('kit', kit)
    if (sort !== 'recent') params.set('sort', sort)
    if (debouncedSearch) params.set('q', debouncedSearch)
    const qs = params.toString()
    router.replace(`/explore${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [kit, sort, debouncedSearch, router])

  const handleLoadMore = () => {
    fetchDisplays({ kit, sort, search: debouncedSearch, page: page + 1, append: true })
  }

  const clearFilters = () => {
    setKit('all')
    setSort('recent')
    setSearch('')
    setDebouncedSearch('')
  }

  const hasActiveFilters = kit !== 'all' || sort !== 'recent' || search !== ''

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 border-b border-border/50 bg-gradient-to-r from-galli/10 via-galli-aqua/5 to-galli-violet/10 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/gallio-frog.svg" alt="Gallio" width={28} height={28} />
            <span className="font-bold text-lg bg-gradient-to-r from-galli to-galli-aqua bg-clip-text text-transparent">
              Gallio
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="px-4 py-1.5 rounded-full text-sm font-medium bg-galli text-white hover:bg-galli/90 transition"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-1.5 rounded-full text-sm font-medium text-foreground hover:bg-muted transition"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-1.5 rounded-full text-sm font-medium bg-galli text-white hover:bg-galli/90 transition"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gradient-to-br from-galli/10 via-galli-aqua/5 to-galli-violet/10 border-b border-border/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="flex items-center gap-3 mb-3">
            <Compass className="w-8 h-8 text-galli" />
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-galli via-galli-aqua to-galli-violet bg-clip-text text-transparent">
              Explore Gallio
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-xl">
            Discover published pages from athletes, creators, and professionals.
          </p>
          <p className="text-sm text-muted-foreground/60 mt-2">
            {total.toLocaleString()} published {total === 1 ? 'page' : 'pages'}
          </p>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-14 z-20 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            {/* Kit filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              {KIT_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setKit(f.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    kit === f.value
                      ? 'bg-galli text-white shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 sm:ml-auto items-center">
              {/* Sort dropdown */}
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  className="appearance-none bg-muted text-sm rounded-lg px-3 py-1.5 pr-8 border border-border/50 focus:outline-none focus:ring-2 focus:ring-galli/30"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>

              {/* Search input */}
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pages..."
                  className="w-full sm:w-56 pl-9 pr-8 py-1.5 text-sm rounded-lg bg-muted border border-border/50 focus:outline-none focus:ring-2 focus:ring-galli/30 placeholder:text-muted-foreground/50"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: pageSize }).map((_, i) => (
              <ExploreCardSkeleton key={i} />
            ))}
          </div>
        ) : displays.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <Image
              src="/gallio-frog.svg"
              alt=""
              width={48}
              height={48}
              className="mx-auto opacity-50 mb-4"
            />
            <h2 className="text-lg font-semibold text-foreground mb-1">No pages found</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Try different filters or search terms.
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 rounded-full text-sm font-medium bg-galli text-white hover:bg-galli/90 transition"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {displays.map((display, i) => (
                <ExploreCard key={display.id} display={display} index={i} />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 rounded-full text-sm font-medium bg-muted hover:bg-muted/80 text-foreground transition disabled:opacity-60 flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
