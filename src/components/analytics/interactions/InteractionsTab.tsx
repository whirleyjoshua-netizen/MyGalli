'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deriveStatus,
  filterElements,
  groupByType,
  sortElements,
  type ElementFilter,
  type ElementStatus,
  type ElementSummary,
  type SortMode,
} from '@/lib/element-os'
import { DataIllustration } from '@/components/analytics/DataIllustration'
import { InsightsStrip } from './InsightsStrip'
import { FilterRail } from './FilterRail'
import { TypeGroup } from './TypeGroup'
import { ElementCard } from './ElementCard'
import { ElementDrawer, type DrawerTab } from './ElementDrawer'
import { useElementSeen } from './useElementSeen'

const PULSE_MS = 30_000

const EMPTY_FILTER: ElementFilter = { search: '', types: [], statuses: [], source: 'all' }

interface Inventory {
  elements: ElementSummary[]
  totals: { elements: number; responses: number; avgEngagement: number | null; liveNow: number }
  truncated: boolean
}

export function InteractionsTab() {
  const [data, setData] = useState<Inventory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloads, setReloads] = useState(0)
  const [filter, setFilter] = useState<ElementFilter>(EMPTY_FILTER)
  const [sort, setSort] = useState<SortMode>('most-active')
  const [open, setOpen] = useState<{ element: ElementSummary; tab: DrawerTab } | null>(null)
  const { seen, markSeen } = useElementSeen()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    fetch('/api/data/elements')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloads])

  // Patch counts in place rather than refetching the whole inventory.
  const hasData = data !== null
  useEffect(() => {
    if (!hasData) return
    const tick = async () => {
      if (typeof document !== 'undefined' && document.hidden) return
      try {
        const res = await fetch('/api/data/elements/pulse')
        if (!res.ok) return
        const { pulse } = await res.json()
        const byKey = new Map<string, { lastResponseAt: string | null; todayCount: number }>(
          (pulse ?? []).map((p: { key: string; lastResponseAt: string | null; todayCount: number }) => [
            p.key,
            { lastResponseAt: p.lastResponseAt, todayCount: p.todayCount },
          ])
        )
        setData((prev) =>
          prev
            ? {
                ...prev,
                elements: prev.elements.map((e) => {
                  const p = byKey.get(e.key)
                  return p ? { ...e, lastResponseAt: p.lastResponseAt, todayCount: p.todayCount } : e
                }),
              }
            : prev
        )
      } catch {
        // A failed pulse is not worth surfacing; the next tick retries.
      }
    }
    const id = setInterval(tick, PULSE_MS)
    return () => clearInterval(id)
  }, [hasData])

  // Status is finalised here, not on the server: part of the needs-attention
  // rule depends on a localStorage stamp the server cannot see.
  const withStatus = useMemo(() => {
    const now = new Date()
    return (data?.elements ?? []).map((e) => ({
      ...e,
      status: deriveStatus({
        published: e.published,
        lastResponseAt: e.lastResponseAt,
        unreadCount: e.unreadCount,
        pendingCount: e.pendingCount,
        lastSeenAt: seen[e.key] ?? null,
        now,
      }),
    }))
  }, [data, seen])

  const statusCounts = useMemo(() => {
    const counts: Record<ElementStatus, number> = { 'needs-attention': 0, live: 0, draft: 0, idle: 0 }
    for (const e of withStatus) counts[e.status] += 1
    return counts
  }, [withStatus])

  const visible = useMemo(
    () => sortElements(filterElements(withStatus, filter), sort),
    [withStatus, filter, sort]
  )

  const openDrawer = useCallback(
    (element: ElementSummary, tab: DrawerTab) => {
      setOpen({ element, tab })
      markSeen(element.key)
    },
    [markSeen]
  )

  if (loading && !data) {
    return (
      <div data-testid="element-grid-skeleton" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-muted/40" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <h2 className="mb-2 text-lg font-medium">Couldn&apos;t load your elements</h2>
        <button
          onClick={() => setReloads((c) => c + 1)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data || data.elements.length === 0) {
    return (
      <div className="py-20 text-center">
        <DataIllustration variant="sprout" className="mx-auto mb-4 h-32" />
        <h2 className="mb-2 text-lg font-medium">No interactive elements yet</h2>
        <p className="text-muted-foreground">Add a poll, form, or wait list to a page to start collecting.</p>
      </div>
    )
  }

  const groups = groupByType(visible)

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <InsightsStrip
            totals={{ ...data.totals, needsAttention: statusCounts['needs-attention'] }}
            onFilterStatus={(status) => setFilter({ ...EMPTY_FILTER, statuses: [status] })}
          />

          {data.truncated && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
              You have a lot of pages — showing the first 200 pages&apos; elements.
            </p>
          )}

          {groups.length === 0 ? (
            <p className="py-20 text-center text-muted-foreground">No elements match these filters.</p>
          ) : (
            <div className="space-y-8">
              {groups.map((g) => (
                <TypeGroup key={g.label} label={g.label} count={g.elements.length}>
                  {g.elements.map((e) => (
                    <ElementCard
                      key={e.key}
                      element={e}
                      onOpen={openDrawer}
                      // The editor is a single route taking the page as a query
                      // param (`src/app/editor/page.tsx` reads `searchParams.get('id')`).
                      // `/editor/<id>` would 404.
                      editHref={e.source === 'bulletin' ? '/bulletin' : `/editor?id=${e.pageId}`}
                    />
                  ))}
                </TypeGroup>
              ))}
            </div>
          )}
        </div>

        <FilterRail
          filter={filter}
          sort={sort}
          statusCounts={statusCounts}
          onChange={setFilter}
          onSortChange={setSort}
          onReset={() => setFilter(EMPTY_FILTER)}
        />
      </div>

      <ElementDrawer
        element={open?.element ?? null}
        tab={open?.tab ?? 'responses'}
        onTabChange={(tab) => setOpen((o) => (o ? { ...o, tab } : o))}
        onClose={() => setOpen(null)}
      />
    </>
  )
}
