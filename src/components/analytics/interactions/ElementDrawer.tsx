'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, Check, Download } from 'lucide-react'
import type { ElementSummary } from '@/lib/element-os'
import { answerLines, type DetailPayload, type DetailResponse } from '@/lib/interaction-responses'

export type DrawerTab = 'responses' | 'analytics'

interface BulletinPost {
  id: string
  results?: {
    elementId?: string
    respondents?: { user?: { name?: string | null }; answer: unknown }[]
  } | null
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
  // Set when we can tell the payload does not describe THIS element, so we say
  // so rather than rendering another element's respondents.
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)

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
    setUnavailable(null)
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
          // /api/bulletin/analytics aggregates blocks[0] only and returns ONE
          // results object per post. On a post with several instruments those
          // results belong to a different element, and a post whose first block
          // is not a data block drops out of the payload entirely. Showing
          // either as this element's responses would be fabricated data.
          if (!post?.results || post.results.elementId !== element.elementId) {
            setUnavailable(
              'Responses for this instrument aren’t available. Bulletin analytics only reports the first interactive block on a post.'
            )
            return
          }
          const respondents = post.results.respondents ?? []
          setData({
            element: { elementId: element.elementId, type: element.type, title: element.title },
            responses: respondents.map((r) => ({
              answer: r.answer,
              submittedAt: null,
              who: r.user?.name ?? undefined,
            })),
            series: [],
            responseCount: respondents.length,
            responsesTruncated: false,
          })
          return
        }
        setData(d as DetailPayload)
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

  // Restores the comment moderation surface the retired Elements tab used to
  // own: without it a moderated comment wall's pending comments are invisible to
  // visitors AND unreachable by the owner. Same endpoint and payload the old
  // CommentCard used.
  const approve = useCallback(
    async (commentId: string) => {
      if (!element) return
      setApproving(commentId)
      try {
        const res = await fetch(`/api/displays/${element.pageId}/comments`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commentId, approved: true }),
        })
        if (res.ok) {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  responses: prev.responses.map((r) =>
                    r.id === commentId ? { ...r, approved: true } : r
                  ),
                }
              : prev
          )
        }
      } catch (error) {
        console.error('Failed to approve comment:', error)
      } finally {
        setApproving(null)
      }
    },
    [element]
  )

  if (!element) return null

  const isWaitlist = element.type === 'waitlist' && element.source === 'page'
  const emptyMessage = data?.windowDays
    ? `No responses in the last ${data.windowDays} days.`
    : 'No responses yet.'

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
            unavailable ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{unavailable}</p>
            ) : (
            <>
              {isWaitlist && (
                <a
                  href={`/api/waitlist/${element.pageId}/${element.elementId}/export`}
                  className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </a>
              )}
              {data?.notice && (
                <p className="mb-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">{data.notice}</p>
              )}
              {!data?.responses?.length ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
              ) : (
                <>
                  {data.responsesTruncated && (
                    <p className="mb-2 text-xs text-muted-foreground">
                      Showing the most recent 200 of {data.responseCount} responses.
                    </p>
                  )}
                  <ul className="space-y-2">
                    {data.responses.map((r, i) => (
                      <ResponseRow
                        key={r.id ?? i}
                        response={r}
                        canApprove={element.type === 'comment' && !!r.id}
                        approving={!!r.id && approving === r.id}
                        onApprove={approve}
                      />
                    ))}
                  </ul>
                </>
              )}
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

function ResponseRow({
  response,
  canApprove,
  approving,
  onApprove,
}: {
  response: DetailResponse
  canApprove: boolean
  approving: boolean
  onApprove: (commentId: string) => void
}) {
  const lines = answerLines(response.answer)
  const pending = canApprove && response.approved === false
  const when = response.submittedAt ? new Date(response.submittedAt) : null
  const whenText = when && !Number.isNaN(when.getTime()) ? when.toLocaleString() : null
  const footer = [
    response.who,
    response.meta,
    whenText ? `${response.dateLabel ? `${response.dateLabel} ` : ''}${whenText}` : null,
  ].filter(Boolean)

  return (
    <li
      className={`rounded-lg border p-3 ${
        pending ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">(no answer)</p>
          ) : (
            lines.map((l, i) => (
              <p key={i} className="text-sm">
                {l.label && <span className="text-muted-foreground">{l.label}: </span>}
                {l.value}
              </p>
            ))
          )}
        </div>
        {pending && response.id && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-xs text-yellow-700">Pending</span>
            <button
              onClick={() => onApprove(response.id as string)}
              disabled={approving}
              aria-label="Approve"
              title="Approve"
              className="rounded p-1 text-green-600 transition hover:bg-green-500/20 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {footer.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">{footer.join(' · ')}</p>
      )}
    </li>
  )
}
