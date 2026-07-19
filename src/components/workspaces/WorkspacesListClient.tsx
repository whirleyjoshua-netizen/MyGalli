'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, LayoutGrid, List, Database } from 'lucide-react'
import { PageHero } from '@/components/dashboard/PageHero'
import { CreateWorkspaceModal } from './CreateWorkspaceModal'
import { WorkspaceCard, type WorkspaceListItem } from './WorkspaceCard'
import { FeatureTour, TemplatesComingSoon, TipsRail } from './WorkspacesLandingSections'

type SortKey = 'recent' | 'name'
type Layout = 'grid' | 'list'

export function WorkspacesListClient() {
  const [items, setItems] = useState<WorkspaceListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [layout, setLayout] = useState<Layout>('grid')

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('galli-ws-layout') : null
    if (saved === 'grid' || saved === 'list') setLayout(saved)
  }, [])

  useEffect(() => {
    fetch('/api/workspaces')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  function chooseLayout(next: Layout) {
    setLayout(next)
    try { window.localStorage.setItem('galli-ws-layout', next) } catch {}
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? items.filter((w) => w.name.toLowerCase().includes(q) || (w.description ?? '').toLowerCase().includes(q))
      : items
    const sorted = [...filtered].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : b.lastActivity.localeCompare(a.lastActivity)
    )
    return sorted
  }, [items, search, sort])

  return (
    <div className="pb-7">
      <PageHero
        icon={<Database className="w-7 h-7 text-primary" />}
        title="Workspaces"
        subtitle="Your data, organized."
        action={
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-galli px-4 py-2 font-medium text-white">
            <Plus size={18} /> New workspace
          </button>
        }
      />

      <div className="px-6 lg:px-8">
      <FeatureTour />
      <TemplatesComingSoon />

      {/* Your workspaces */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your workspaces</h2>
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <Database className="mx-auto mb-3 text-muted-foreground" />
            <p className="mb-1 font-medium">No workspaces yet</p>
            <p className="mb-4 text-sm text-muted-foreground">Create your first workspace to start organizing your data.</p>
            <button onClick={() => setShowCreate(true)} className="rounded-lg bg-galli px-4 py-2 font-medium text-white">
              Create your first workspace 🌿
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
            <div>
              {/* Controls */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workspaces…"
                    className="w-full rounded-lg border border-border bg-transparent py-2 pl-9 pr-3 text-sm" />
                </div>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm">
                  <option value="recent">Recently updated</option>
                  <option value="name">Name</option>
                </select>
                <div className="flex overflow-hidden rounded-lg border border-border">
                  <button onClick={() => chooseLayout('grid')} title="Grid view" aria-label="Grid view"
                    className={`px-2.5 py-2 ${layout === 'grid' ? 'bg-muted text-galli' : 'text-muted-foreground'}`}><LayoutGrid size={16} /></button>
                  <button onClick={() => chooseLayout('list')} title="List view" aria-label="List view"
                    className={`px-2.5 py-2 ${layout === 'list' ? 'bg-muted text-galli' : 'text-muted-foreground'}`}><List size={16} /></button>
                </div>
              </div>

              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workspaces match &ldquo;{search}&rdquo;.</p>
              ) : layout === 'grid' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {visible.map((ws) => <WorkspaceCard key={ws.id} ws={ws} layout="grid" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {visible.map((ws) => <WorkspaceCard key={ws.id} ws={ws} layout="list" />)}
                </div>
              )}
            </div>

            <TipsRail />
          </div>
        )}
      </section>
      </div>

      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
