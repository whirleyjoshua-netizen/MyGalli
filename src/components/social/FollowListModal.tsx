'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { FollowButton } from '@/components/social/FollowButton'

interface Row {
  username: string
  name: string | null
  avatar: string | null
  isFollowing: boolean
}

export function FollowListModal({
  isOpen,
  onClose,
  username,
  mode,
}: {
  isOpen: boolean
  onClose: () => void
  username: string
  mode: 'followers' | 'following'
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetch(`/api/users/${username}/${mode}`)
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setRows(Array.isArray(d?.users) ? d.users : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [isOpen, username, mode])

  if (!isOpen) return null

  const initialOf = (r: Row) => (r.name || r.username).charAt(0).toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-soft-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold capitalize">{mode}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No {mode} yet.</p>
          ) : (
            <ul className="space-y-1">
              {rows.map((r) => (
                <li key={r.username} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-muted transition-colors">
                  <Link href={`/${r.username}`} onClick={onClose} className="flex items-center gap-2.5 flex-1 min-w-0">
                    {r.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.avatar} alt="" className="w-9 h-9 rounded-lg object-cover" />
                    ) : (
                      <span className="w-9 h-9 rounded-lg bg-primary/15 text-primary font-bold flex items-center justify-center">{initialOf(r)}</span>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.name || r.username}</p>
                      <p className="text-xs text-muted-foreground truncate">@{r.username}</p>
                    </div>
                  </Link>
                  <FollowButton username={r.username} initialIsFollowing={r.isFollowing} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
