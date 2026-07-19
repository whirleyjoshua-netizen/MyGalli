'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Users, LayoutGrid, List, Plus } from 'lucide-react'
import {
  filterSortCommunities, filterSortCollabs,
  type PondCommunity, type PondCollab, type PondFilter, type PondSort,
} from '@/lib/pond'
import { PageHero } from '@/components/dashboard/PageHero'
import { PondWelcomeBanner } from '@/components/pond/PondWelcomeBanner'
import { PondToolbar } from '@/components/pond/PondToolbar'
import { CommunityCard } from '@/components/pond/CommunityCard'
import { CollabCard } from '@/components/pond/CollabCard'
import { GetMoreCard } from '@/components/pond/GetMoreCard'
import { NewCommunityModal } from '@/components/pond/NewCommunityModal'

export default function MyPondPage() {
  return (
    <Suspense fallback={<div className="px-6 lg:px-8 py-7"><p className="text-sm text-muted-foreground">Loading…</p></div>}>
      <MyPondContent />
    </Suspense>
  )
}

function MyPondContent() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'collabs' | 'communities'>(
    searchParams.get('tab') === 'collabs' ? 'collabs' : 'communities'
  )
  const [communities, setCommunities] = useState<PondCommunity[]>([])
  const [collabs, setCollabs] = useState<PondCollab[]>([])
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<PondFilter>('all')
  const [sort, setSort] = useState<PondSort>('active')
  const [welcomeDismissed, setWelcomeDismissed] = useState(true)
  const [newOpen, setNewOpen] = useState(false)

  // hydrate persisted UI prefs
  useEffect(() => {
    setWelcomeDismissed(localStorage.getItem('pond-welcome-dismissed') === '1')
    const v = localStorage.getItem('pond-view')
    if (v === 'grid' || v === 'list') setView(v)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/communities/joined').then((r) => (r.ok ? r.json() : { communities: [] })).then((d) => setCommunities(Array.isArray(d?.communities) ? d.communities : [])).catch(() => {}),
      fetch('/api/collaborations').then((r) => (r.ok ? r.json() : { displays: [] })).then((d) => setCollabs(Array.isArray(d?.displays) ? d.displays : [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const setViewPersist = (v: 'grid' | 'list') => { setView(v); localStorage.setItem('pond-view', v) }
  const dismissWelcome = () => { setWelcomeDismissed(true); localStorage.setItem('pond-welcome-dismissed', '1') }

  const visibleCommunities = useMemo(
    () => filterSortCommunities(communities, { query, filter, sort }),
    [communities, query, filter, sort]
  )
  const visibleCollabs = useMemo(
    () => filterSortCollabs(collabs, { query, sort }),
    [collabs, query, sort]
  )

  const isCommunities = activeTab === 'communities'

  return (
    <div className="pb-7">
      <PageHero
        icon={<Users className="w-7 h-7 text-primary" />}
        title="My Pond"
        subtitle="Communities you&apos;ve joined and pages you collaborate on."
        controls={
          <div className="flex items-center rounded-xl border border-border overflow-hidden bg-surface/80 backdrop-blur-sm">
            <button aria-label="Grid view" onClick={() => setViewPersist('grid')} className={`p-2 ${view === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}><LayoutGrid className="w-4 h-4" /></button>
            <button aria-label="List view" onClick={() => setViewPersist('list')} className={`p-2 ${view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}><List className="w-4 h-4" /></button>
          </div>
        }
        action={
          <button onClick={() => setNewOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90">
            <Plus className="w-4 h-4" /> New community
          </button>
        }
        tabs={([['communities', 'Communities', communities.length], ['collabs', 'Collabs', collabs.length]] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label} <span className="font-normal text-muted-foreground">({count})</span>
          </button>
        ))}
      />

      <div className="px-6 lg:px-8">
        {!welcomeDismissed && <PondWelcomeBanner onDismiss={dismissWelcome} />}

        <PondToolbar
          query={query} onQuery={setQuery}
          filter={filter} onFilter={setFilter}
          sort={sort} onSort={setSort}
          showFilter={isCommunities}
          searchPlaceholder={isCommunities ? 'Search communities...' : 'Search pages...'}
        />

        <div className="flex gap-6">
          <main className="flex-1 min-w-0">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : isCommunities ? (
              communities.length === 0 ? (
                <EmptyState title="No communities in your pond yet." hint="Create one to start connecting." action={() => setNewOpen(true)} />
              ) : visibleCommunities.length === 0 ? (
                <EmptyState title={query.trim() ? `No communities match “${query}”.` : 'No communities match this filter.'} />
              ) : (
                <CardGrid view={view}>
                  {visibleCommunities.map((c) => <CommunityCard key={c.id} community={c} view={view} />)}
                </CardGrid>
              )
            ) : collabs.length === 0 ? (
              <EmptyState title="No pages shared with you yet." hint="When someone invites you to collaborate, it shows up here." />
            ) : visibleCollabs.length === 0 ? (
              <EmptyState title={`No pages match “${query}”.`} />
            ) : (
              <CardGrid view={view}>
                {visibleCollabs.map((d) => <CollabCard key={d.id} collab={d} view={view} />)}
              </CardGrid>
            )}
          </main>

          <aside className="w-72 shrink-0 hidden xl:block">
            <GetMoreCard onCreate={() => setNewOpen(true)} />
          </aside>
        </div>

        <NewCommunityModal open={newOpen} onClose={() => setNewOpen(false)} />
      </div>
    </div>
  )
}

function CardGrid({ view, children }: { view: 'grid' | 'list'; children: React.ReactNode }) {
  if (view === 'list') return <div className="flex flex-col gap-3">{children}</div>
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{children}</div>
}

function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: () => void }) {
  return (
    <div className="text-center py-20 border border-dashed border-border rounded-2xl">
      <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-muted-foreground">{title}</p>
      {hint && <p className="text-sm text-muted-foreground/70 mt-1">{hint}</p>}
      {action && (
        <button onClick={action} className="mt-4 inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90">
          Create a community
        </button>
      )}
    </div>
  )
}
