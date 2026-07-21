'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ElementSummary } from '@/lib/element-os'

export type DrawerTab = 'responses' | 'analytics'

interface DetailPayload {
  element: { elementId: string; type: string; title: string }
  responses: { answer: unknown; submittedAt: string | null; who?: string }[]
  series: { date: string; count: number }[]
  responsesTruncated?: boolean
  responseCount?: number
}

interface BulletinPost {
  id: string
  results?: { respondents?: { user?: { name?: string | null }; answer: unknown }[] } | null
}

export function ElementDrawer({
  element,
  tab,
  onTabChange,
  onClose,
}: {
  element: ElementSummary | null
  tab: DrawerTab
  onTabChange: (tab: DrawerTab) => void
  onClose: () => void
}) {
  const [data, setData] = useState<DetailPayload | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!element) return
    let cancelled = false
    setLoading(true)
    setData(null)
    // Bulletin instruments live on posts, not pages, and are served by the
    // existing bulletin analytics endpoint.
    const url =
      element.source === 'bulletin'
        ? '/api/bulletin/analytics'
        : `/api/data/elements/${element.pageId}/${element.elementId}`
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        if (!d) return setData(null)
        if (element.source === 'bulletin') {
          const posts = (d.posts ?? []) as BulletinPost[]
          const post = posts.find((p) => p.id === element.pageId)
          const respondents = post?.results?.respondents ?? []
          setData({
            element: { elementId: element.elementId, type: element.type, title: element.title },
            responses: respondents.map((r) => ({
              answer: r.answer,
              submittedAt: null,
              who: r.user?.name ?? undefined,
            })),
            series: [],
          })
          return
        }
        setData(d)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [element])

  if (!element) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">{element.title}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {element.responseCount.toLocaleString('en-US')} responses
              {element.engagement !== null && ` · ${element.engagement}% engagement`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-border px-4">
          {(['responses', 'analytics'] as DrawerTab[]).map((t) => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className={`border-b-2 px-3 py-2 text-sm font-medium capitalize transition ${
                tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : tab === 'responses' ? (
            !data?.responses?.length ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No responses yet.</p>
            ) : (
              <>
                {data.responsesTruncated && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Showing the most recent 200 of {data.responseCount} responses.
                  </p>
                )}
                <ul className="space-y-2">
                  {data.responses.map((r, i) => (
                    <li key={i} className="rounded-lg border border-border p-3">
                      <p className="text-sm">{Array.isArray(r.answer) ? r.answer.join(', ') : String(r.answer ?? '')}</p>
                      {(r.who || r.submittedAt) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.who ?? (r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '')}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : element.source === 'bulletin' ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Per-day activity isn&apos;t available for bulletin instruments.
            </p>
          ) : !data?.series?.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No activity in the last 30 days.</p>
          ) : (
            <ul className="space-y-1">
              {data.series.map((d) => (
                <li key={d.date} className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-muted-foreground">{d.date}</span>
                  <span className="h-2 rounded-full bg-galli" style={{ width: `${Math.min(100, d.count * 8)}px` }} />
                  <span className="text-muted-foreground">{d.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
