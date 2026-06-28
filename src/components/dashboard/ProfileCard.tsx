'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Eye } from 'lucide-react'
import { useAuthStore } from '@/lib/store'

function fmt(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

export function ProfileCard() {
  const { user } = useAuthStore()
  const [followers, setFollowers] = useState<number | null>(null)
  const [views, setViews] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/displays')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setViews(Array.isArray(d) ? d.reduce((s: number, x: { views?: number }) => s + (x.views || 0), 0) : 0))
      .catch(() => setViews(0))
    if (user?.username) {
      fetch(`/api/users/${user.username}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setFollowers(d?.followerCount ?? 0))
        .catch(() => setFollowers(0))
    }
  }, [user?.username])

  if (!user) return null
  const initial = (user.name || user.username || '?').charAt(0).toUpperCase()

  return (
    <Link
      href={`/${user.username}`}
      className="block mb-3 p-3 rounded-2xl border border-border bg-surface hover:border-primary/30 hover:shadow-soft transition-all cursor-pointer"
    >
      <div className="flex items-center gap-2.5">
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
        ) : (
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-galli/30 to-galli-violet/30 text-galli-dark font-bold flex items-center justify-center shrink-0">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate leading-tight">{user.name || user.username}</p>
          <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
        </div>
      </div>

      {user.bio && <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-snug">{user.bio}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex flex-col items-center py-1.5 rounded-xl bg-muted/60">
          <span className="flex items-center gap-1 text-sm font-bold text-foreground">
            <Users className="w-3.5 h-3.5 text-primary" /> {fmt(followers)}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Followers</span>
        </div>
        <div className="flex flex-col items-center py-1.5 rounded-xl bg-muted/60">
          <span className="flex items-center gap-1 text-sm font-bold text-foreground">
            <Eye className="w-3.5 h-3.5 text-galli-aqua" /> {fmt(views)}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Page views</span>
        </div>
      </div>
    </Link>
  )
}
