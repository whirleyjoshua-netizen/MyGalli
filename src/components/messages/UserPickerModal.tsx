'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { mergeSocialGraph, filterPickerUsers, type PickerUser, type SocialRow } from '@/lib/dm-picker'

async function loadList(username: string, mode: 'followers' | 'following'): Promise<SocialRow[]> {
  try {
    const res = await fetch(`/api/users/${username}/${mode}`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.users) ? data.users : []
  } catch {
    return []
  }
}

export function UserPickerModal({
  myUsername,
  onSelect,
  onClose,
}: {
  myUsername: string
  onSelect: (username: string) => void
  onClose: () => void
}) {
  const [people, setPeople] = useState<PickerUser[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadList(myUsername, 'followers'), loadList(myUsername, 'following')])
      .then(([followers, following]) => {
        if (cancelled) return
        setPeople(mergeSocialGraph(followers, following))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [myUsername])

  const rows = useMemo(() => filterPickerUsers(people, query), [people, query])
  // The picker only knows the viewer's own graph. A typed username that matches
  // nobody in it is still a valid person to message, so offer it directly
  // rather than dead-ending where the old window.prompt would have worked.
  const fallback = query.trim().replace(/^@/, '')
  const showFallback = !loading && rows.length === 0 && fallback.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-bold">New message</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border p-3">
          <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people or type a username"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {loading ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : showFallback ? (
            <button
              onClick={() => onSelect(fallback)}
              className="w-full cursor-pointer rounded-xl p-3 text-left text-sm font-medium hover:bg-muted"
            >
              Message @{fallback}
            </button>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Follow someone to start a conversation, or type their username above.
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((r) => (
                <li key={r.username}>
                  <button
                    onClick={() => onSelect(r.username)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-muted"
                  >
                    {r.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.avatar} alt="" className="h-9 w-9 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 font-bold text-primary">
                        {(r.name || r.username).charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name || r.username}</p>
                      <p className="truncate text-xs text-muted-foreground">@{r.username}</p>
                    </div>
                    {r.isMutual && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        Friend
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
