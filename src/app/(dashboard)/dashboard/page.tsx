'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Bell, Plus, Globe, FileText } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import type { DashboardPrefs } from '@/lib/types/dashboard'
import { ScrollRow } from '@/components/dashboard/ScrollRow'
import { PageCard, type DashDisplay } from '@/components/dashboard/PageCard'
import { FeedCard, type FeedItem } from '@/components/dashboard/FeedCard'
import { AnalyticsPanel } from '@/components/dashboard/AnalyticsPanel'

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

  useEffect(() => {
    fetch('/api/displays')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: DashDisplay[]) => {
        setDisplays(Array.isArray(d) ? d : [])
        if (Array.isArray(d) && d.length > 0) setSelectedId((cur) => cur ?? d[0].id)
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
    <div className="flex">
      {/* Center column */}
      <div className="flex-1 min-w-0 px-6 lg:px-8 py-7">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-muted-foreground mt-1">Everything you create lives in your universe.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3.5 h-10 rounded-full border border-border bg-surface text-muted-foreground w-56">
              <Search className="w-4 h-4 shrink-0" />
              <input
                aria-label="Search"
                placeholder="Search anything..."
                className="bg-transparent outline-none text-sm w-full placeholder:text-muted-foreground"
              />
            </div>
            <button
              aria-label="Notifications"
              className="relative w-10 h-10 rounded-full border border-border bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-galli-violet" />
            </button>
          </div>
        </div>

        {/* Public feed */}
        <ScrollRow
          title={feedLabel === 'follow' ? 'Public feed' : 'Discover'}
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
              onSelect={(id) => router.push(`/editor?id=${id}`)}
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
        </ScrollRow>

        {loading && displays.length === 0 && (
          <p className="text-sm text-muted-foreground">Loading your pages…</p>
        )}
      </div>

      {/* Right analytics panel */}
      <AnalyticsPanel display={selected} username={user?.username} />
    </div>
  )
}
