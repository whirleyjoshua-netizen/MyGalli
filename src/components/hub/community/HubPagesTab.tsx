'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutGrid, Check, X } from 'lucide-react'
import type { HubPageDTO } from '@/lib/hub-pages'
import { HubPageAttachModal } from './HubPageAttachModal'

export function HubPagesTab({
  hubId, canManage, canAttach, currentUserId, initialPages,
}: {
  hubId: string
  canManage: boolean
  /** Member of the hub (or privileged), so submitting won't 403. Gates the trigger and empty-state shell only — the approved grid stays visible to everyone who can view the hub. */
  canAttach: boolean
  currentUserId: string | null
  initialPages: HubPageDTO[]
}) {
  const [pages, setPages] = useState<HubPageDTO[]>(initialPages)
  // `useState`'s argument only seeds the initial render — it is ignored on
  // every subsequent one. When the server component re-runs (e.g. after
  // `router.refresh()` following an attach) and hands us a new
  // `initialPages` array, sync local state to it here. This is React's
  // documented "adjusting state during render" pattern: comparing against a
  // previous-props snapshot kept in state lets us reset synchronously,
  // without an effect, and without clobbering the optimistic updates that
  // `review()` makes between refreshes (those don't change the
  // `initialPages` reference, so this check stays false for them).
  const [prevInitialPages, setPrevInitialPages] = useState<HubPageDTO[]>(initialPages)
  if (initialPages !== prevInitialPages) {
    setPrevInitialPages(initialPages)
    setPages(initialPages)
  }
  const router = useRouter()
  const [attaching, setAttaching] = useState(false)

  const approved = pages.filter((p) => p.status === 'approved')
  const queue = canManage ? pages.filter((p) => p.status === 'pending') : []
  const queueIds = new Set(queue.map((p) => p.id))
  const mine = currentUserId
    ? pages.filter((p) => p.status !== 'approved' && p.addedById === currentUserId && !queueIds.has(p.id))
    : []

  async function review(id: string, status: 'approved' | 'rejected') {
    try {
      const res = await fetch(`/api/hubs/${hubId}/pages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) return
      setPages((cur) =>
        status === 'approved'
          ? cur.map((p) => (p.id === id ? { ...p, status: 'approved' } : p))
          : cur.filter((p) => p.id !== id),
      )
    } catch {
      // Network failure: leave state unchanged; nothing to surface here.
    }
  }

  const showTrigger = (canAttach || canManage) && !!currentUserId

  return (
    <div className="space-y-8">
      {showTrigger && (
        <div className="flex justify-end">
          <button
            onClick={() => setAttaching(true)}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft"
          >
            Attach a Page
          </button>
        </div>
      )}
      {attaching && (
        <HubPageAttachModal
          hubId={hubId}
          attachedDisplayIds={pages.map((p) => p.displayId)}
          onClose={() => setAttaching(false)}
          onAttached={() => router.refresh()}
        />
      )}
      {queue.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Needs review ({queue.length})
          </h3>
          <ul className="space-y-2">
            {queue.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                <Link href={`/${p.ownerUsername}/${p.slug}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                  {p.title}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">by @{p.ownerUsername}</span>
                <button onClick={() => review(p.id, 'approved')} aria-label={`Approve ${p.title}`} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  <Check className="mr-1 inline h-3 w-3" />Approve
                </button>
                <button onClick={() => review(p.id, 'rejected')} aria-label={`Reject ${p.title}`} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                  <X className="mr-1 inline h-3 w-3" />Reject
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mine.length > 0 && (
        <ul className="space-y-2">
          {mine.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{p.title}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">{p.status}</span>
            </li>
          ))}
        </ul>
      )}

      {approved.length === 0 && queue.length === 0 && mine.length === 0 ? (
        showTrigger && (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <LayoutGrid className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No pages yet.</p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {approved.map((p) => (
            <Link
              key={p.id}
              href={`/${p.ownerUsername}/${p.slug}`}
              className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition hover:shadow-soft-lg"
            >
              <div className="aspect-[4/3] w-full bg-gradient-to-br from-galli/20 to-galli-aqua/10">
                {p.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverImage} alt="" aria-hidden className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold">{p.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">by @{p.ownerUsername}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
