'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Globe, FileEdit } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import type { DashboardPrefs } from '@/lib/types/dashboard'
import { PageCard, type DashDisplay } from '@/components/dashboard/PageCard'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'

type Community = { id: string; title: string; username: string; slug: string; coverImage: string | null; latestPost: { text: string | null; createdAt: string } | null }

const GRADIENTS = [
  'from-galli/20 via-galli-aqua/10 to-galli-violet/10',
  'from-galli-aqua/20 via-galli-violet/10 to-galli/10',
  'from-galli-violet/20 via-galli/10 to-galli-aqua/10',
  'from-galli/15 via-galli-aqua/10 to-transparent',
  'from-galli-violet/15 via-galli/10 to-transparent',
]

export default function MyPagesPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [displays, setDisplays] = useState<DashDisplay[]>([])
  const [prefs, setPrefs] = useState<DashboardPrefs>({})
  const [loading, setLoading] = useState(true)
  const [cardMenuOpen, setCardMenuOpen] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'pages' | 'boards' | 'communities'>('pages')
  const [communities, setCommunities] = useState<Community[]>([])
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  useEffect(() => {
    fetch('/api/displays')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: DashDisplay[]) => setDisplays(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
    fetch('/api/dashboard-prefs')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setPrefs(d || {}))
      .catch(() => {})
    fetch('/api/communities/joined')
      .then((r) => (r.ok ? r.json() : { communities: [] }))
      .then((d) => setCommunities(Array.isArray(d?.communities) ? d.communities : []))
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
      if (res.ok) setDisplays((prev) => prev.filter((x) => x.id !== id))
    } catch {}
  }, [displays])

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

  const pinnedSet = useMemo(() => new Set(prefs.pinnedDisplayIds || []), [prefs.pinnedDisplayIds])

  const sortPinnedFirst = (list: DashDisplay[]) => [
    ...list.filter((d) => pinnedSet.has(d.id)),
    ...list.filter((d) => !pinnedSet.has(d.id)),
  ]

  const boardCount = useMemo(() => displays.filter((d) => d.kind === 'collection').length, [displays])
  const pageCount = displays.length - boardCount
  const activeList = useMemo(
    () => displays.filter((d) => (activeTab === 'boards' ? d.kind === 'collection' : d.kind !== 'collection')),
    [displays, activeTab],
  )
  const published = useMemo(() => sortPinnedFirst(activeList.filter((d) => d.published)), [activeList, pinnedSet])
  const drafts = useMemo(() => sortPinnedFirst(activeList.filter((d) => !d.published)), [activeList, pinnedSet])

  const renderCard = (display: DashDisplay, i: number) => (
    <PageCard
      key={display.id}
      display={display}
      gradient={GRADIENTS[i % GRADIENTS.length]}
      selected={false}
      isPinned={pinnedSet.has(display.id)}
      isMenuOpen={cardMenuOpen === display.id}
      username={user?.username}
      timeAgo={timeAgo}
      onOpen={(id) => router.push(`/editor?id=${id}`)}
      onOpenMenu={(id) => setCardMenuOpen((cur) => (cur === id ? null : id))}
      onCloseMenu={() => setCardMenuOpen(null)}
      onTogglePin={togglePin}
      onDelete={deleteDisplay}
      onCoverChange={handleCoverChange}
    />
  )

  return (
    <div className="px-6 lg:px-8 py-7">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Gallery</h1>
          <p className="text-muted-foreground mt-1">Your pages and boards — live and in progress.</p>
        </div>
        {activeTab === 'communities' ? null : activeTab === 'boards' ? (
          <button
            onClick={createBoard}
            className="inline-flex shrink-0 items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full font-semibold shadow-soft hover:brightness-105 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New board
          </button>
        ) : (
          <button
            onClick={() => router.push('/editor')}
            className="inline-flex shrink-0 items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full font-semibold shadow-soft hover:brightness-105 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New page
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-8 border-b border-border">
        {([['pages', 'Pages', pageCount], ['boards', 'Boards', boardCount], ['communities', 'Communities', communities.length]] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 -mb-px text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label} <span className="font-normal text-muted-foreground">({count})</span>
          </button>
        ))}
      </div>

      {activeTab === 'communities' ? (
        communities.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven&apos;t joined any communities yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {communities.map((c) => (
              <a key={c.id} href={`/${c.username}/hub/${c.slug}`} className="rounded-xl border border-border bg-surface p-4 hover:shadow-soft transition">
                <div className="font-semibold">{c.title}</div>
                <div className="mt-1 text-xs text-muted-foreground truncate">{c.latestPost?.text || 'No posts yet'}</div>
              </a>
            ))}
          </div>
        )
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : activeList.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <p className="text-muted-foreground mb-4">
            {activeTab === 'boards' ? "You haven't created any boards yet." : "You haven't created any pages yet."}
          </p>
          <button
            onClick={activeTab === 'boards' ? createBoard : () => router.push('/editor')}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-full font-semibold shadow-soft hover:brightness-105 transition-all cursor-pointer"
          >
            {activeTab === 'boards' ? 'Create a board' : 'Create your first page'}
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Published */}
          <section>
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
              <Globe className="w-4 h-4 text-primary" /> Published <span className="font-normal normal-case">({published.length})</span>
            </h2>
            {published.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published pages yet — publish a draft to make it live.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {published.map(renderCard)}
              </div>
            )}
          </section>

          {/* Drafts */}
          <section>
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
              <FileEdit className="w-4 h-4 text-galli-violet" /> Drafts <span className="font-normal normal-case">({drafts.length})</span>
            </h2>
            {drafts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No drafts.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {drafts.map(renderCard)}
              </div>
            )}
          </section>
        </div>
      )}

      <UpgradePrompt isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature="Boards" />
    </div>
  )
}
