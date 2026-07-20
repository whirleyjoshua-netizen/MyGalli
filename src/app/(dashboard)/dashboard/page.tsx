'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Plus, Globe, FileText, LayoutGrid, Home } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import type { DashboardPrefs } from '@/lib/types/dashboard'
import { PageHero } from '@/components/dashboard/PageHero'
import { ScrollRow } from '@/components/dashboard/ScrollRow'
import { PageCard, type DashDisplay } from '@/components/dashboard/PageCard'
import { FeedCard, type FeedItem } from '@/components/dashboard/FeedCard'
import { AnalyticsPanel } from '@/components/dashboard/AnalyticsPanel'
import { NotificationBell } from '@/components/dashboard/NotificationBell'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'

const SELECTED_KEY = 'galli:dash:selectedDisplayId'

const GRADIENTS = [
  'from-galli/20 via-galli-aqua/10 to-galli-violet/10',
  'from-galli-aqua/20 via-galli-violet/10 to-galli/10',
  'from-galli-violet/20 via-galli/10 to-galli-aqua/10',
  'from-galli/15 via-galli-aqua/10 to-transparent',
  'from-galli-violet/15 via-galli/10 to-transparent',
]

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [displays, setDisplays] = useState<DashDisplay[]>([])
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<DashboardPrefs>({})
  const [cardMenuOpen, setCardMenuOpen] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [feedLabel, setFeedLabel] = useState<'follow' | 'discover'>('follow')
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  useEffect(() => {
    fetch('/api/displays')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: DashDisplay[]) => {
        const list = Array.isArray(d) ? d : []
        setDisplays(list)
        if (list.length > 0) {
          // Restore the last page the user opened or picked for the panel;
          // fall back to the most-recent page.
          const stored = typeof window !== 'undefined' ? localStorage.getItem(SELECTED_KEY) : null
          const restored = stored && list.some((x) => x.id === stored) ? stored : list[0].id
          setSelectedId((cur) => cur ?? restored)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    fetch('/api/dashboard-prefs')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setPrefs(d || {}))
      .catch(() => {})

    fetch('/api/feed?page=1&limit=12')
      .then((r) => (r.ok ? r.json() : { empty: true, displays: [] }))
      .then((d) => {
        if (d.empty || !Array.isArray(d.displays) || d.displays.length === 0) {
          setFeedLabel('discover')
          return fetch('/api/explore?sort=popular&page=1&limit=12')
            .then((r) => (r.ok ? r.json() : { displays: [] }))
            .then((e) => setFeed(Array.isArray(e?.displays) ? e.displays : []))
        }
        setFeedLabel('follow')
        setFeed(d.displays)
      })
      .catch(() => {})
  }, [])

  // Set the page the "Audience at a glance" panel reflects, and remember it so
  // it survives the editor round-trip and reloads.
  const rememberSelection = useCallback((id: string) => {
    setSelectedId(id)
    try { localStorage.setItem(SELECTED_KEY, id) } catch {}
  }, [])

  // Whole-card click: open in the editor AND make it the panel's page.
  const handleOpen = useCallback((id: string) => {
    rememberSelection(id)
    router.push(`/editor?id=${id}`)
  }, [rememberSelection, router])

  const createBoard = useCallback(async () => {
    const res = await fetch('/api/displays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled Board', kind: 'collection' }),
    })
    // if (res.status === 403) { setUpgradeOpen(true); return }
    if (!res.ok) return
    const board = await res.json()
    router.push(`/editor?id=${board.id}`)
  }, [router])

  // Chart button: just drive the panel, no navigation.
  const handleSelectPanel = useCallback((id: string) => {
    rememberSelection(id)
  }, [rememberSelection])

  const savePrefs = useCallback(async (next: DashboardPrefs) => {
    setPrefs(next)
    try {
      await fetch('/api/dashboard-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
    } catch {}
  }, [])

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return `${Math.floor(days / 30)}mo ago`
  }

  const sortedDisplays = useMemo(() => {
    const pinned = new Set(prefs.pinnedDisplayIds || [])
    return [...displays.filter((d) => pinned.has(d.id)), ...displays.filter((d) => !pinned.has(d.id))]
  }, [displays, prefs.pinnedDisplayIds])

  const togglePin = useCallback((id: string) => {
    const pinned = new Set(prefs.pinnedDisplayIds || [])
    if (pinned.has(id)) pinned.delete(id)
    else pinned.add(id)
    savePrefs({ ...prefs, pinnedDisplayIds: Array.from(pinned) })
  }, [prefs, savePrefs])

  const handleCoverChange = useCallback(async (id: string, file: File | null) => {
    try {
      let coverImage: string | null = null
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!up.ok) return
        coverImage = (await up.json()).url
      }
      const res = await fetch(`/api/displays/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverImage }),
      })
      if (res.ok) setDisplays((prev) => prev.map((d) => (d.id === id ? { ...d, coverImage } : d)))
    } catch {}
  }, [])

  const deleteDisplay = useCallback(async (id: string) => {
    const d = displays.find((x) => x.id === id)
    if (!d || !window.confirm(`Delete "${d.title}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/displays/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDisplays((prev) => prev.filter((x) => x.id !== id))
        setSelectedId((cur) => (cur === id ? null : cur))
      }
    } catch {}
  }, [displays])

  const pinnedSet = new Set(prefs.pinnedDisplayIds || [])
  const selected = displays.find((d) => d.id === selectedId) || sortedDisplays[0] || null

  return (
    <div className="relative flex min-h-screen">
      {/* Decorative frog watermark — matches Explore */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/gallio-frog.svg"
        alt=""
        aria-hidden
        className="pointer-events-none fixed -bottom-12 -right-12 z-0 w-[26rem] max-w-[45vw] opacity-[0.05]"
      />

      {/* Center column */}
      <div className="relative z-10 flex-1 min-w-0">
        <PageHero
          icon={<Home className="w-7 h-7 text-primary" />}
          title="Your Personal Gallery"
          subtitle="Everything you're building, and what the pond is up to."
          controls={
            <div className="hidden sm:flex items-center gap-2 px-3.5 h-10 rounded-full border border-border bg-surface text-muted-foreground w-56">
              <Search className="w-4 h-4 shrink-0" />
              <input
                aria-label="Search"
                placeholder="Search anything..."
                className="bg-transparent outline-none text-sm w-full placeholder:text-muted-foreground"
              />
            </div>
          }
          action={<NotificationBell />}
        />

        <div className="px-6 lg:px-8 pb-10">
        {/* Public feed */}
        <ScrollRow
          title={feedLabel === 'follow' ? 'Public feed' : 'Explore'}
          subtitle={feedLabel === 'follow' ? 'Pages from people you follow.' : 'Explore what the world is building.'}
          icon={<Globe className="w-4 h-4" />}
          action={<Link href="/explore" className="text-xs font-medium text-primary hover:underline cursor-pointer mr-1">See all</Link>}
        >
          {feed.length === 0 ? (
            <div className="shrink-0 w-full py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
              No public pages yet — published pages from the community show up here.
            </div>
          ) : (
            feed.map((item, i) => <FeedCard key={item.id} item={item} index={i} />)
          )}
        </ScrollRow>

        {/* Row divider */}
        <hr className="mb-8 border-t border-border" />

        {/* My pages */}
        <ScrollRow
          title="My pages"
          subtitle="Your world, your rules."
          icon={<FileText className="w-4 h-4" />}
        >
          {sortedDisplays.map((display, i) => (
            <PageCard
              key={display.id}
              display={display}
              gradient={GRADIENTS[i % GRADIENTS.length]}
              selected={selected?.id === display.id}
              isPinned={pinnedSet.has(display.id)}
              isMenuOpen={cardMenuOpen === display.id}
              username={user?.username}
              timeAgo={timeAgo}
              onOpen={handleOpen}
              onSelectPanel={handleSelectPanel}
              onOpenMenu={(id) => setCardMenuOpen((cur) => (cur === id ? null : id))}
              onCloseMenu={() => setCardMenuOpen(null)}
              onTogglePin={togglePin}
              onDelete={deleteDisplay}
              onCoverChange={handleCoverChange}
            />
          ))}
          {/* Create new page tile */}
          <button
            onClick={() => router.push('/editor')}
            className="group shrink-0 w-60 snap-start rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-primary/[0.03] transition-all cursor-pointer"
            style={{ minHeight: 188 }}
          >
            <span className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Plus className="w-5 h-5 text-primary" />
            </span>
            <span className="text-sm font-medium">Create new page</span>
          </button>
          {/* Create new board tile (Pro) */}
          <button
            onClick={createBoard}
            className="group shrink-0 w-60 snap-start rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-galli-violet/40 hover:text-foreground hover:bg-galli-violet/[0.03] transition-all cursor-pointer"
            style={{ minHeight: 188 }}
          >
            <span className="w-11 h-11 rounded-full bg-galli-violet/10 flex items-center justify-center group-hover:bg-galli-violet/20 transition-colors">
              <LayoutGrid className="w-5 h-5 text-galli-violet" />
            </span>
            <span className="text-sm font-medium">New board</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-galli-violet">Pro</span>
          </button>
        </ScrollRow>

        {loading && displays.length === 0 && (
          <p className="text-sm text-muted-foreground">Loading your pages…</p>
        )}
        </div>
      </div>

      {/* Right analytics panel */}
      <AnalyticsPanel display={selected} username={user?.username} />

      <UpgradePrompt isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature="Boards" />
    </div>
  )
}
