'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Users, Eye, MoreVertical, UserCircle, Settings, LogOut } from 'lucide-react'
import { useAuthStore } from '@/lib/store'

function fmt(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

export function ProfileCard({ collapsed = false }: { collapsed?: boolean }) {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [followers, setFollowers] = useState<number | null>(null)
  const [views, setViews] = useState<number | null>(null)

  useEffect(() => {
    if (collapsed) return // stats only shown in the expanded card
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
  }, [user?.username, collapsed])

  if (!user) return null
  const initial = (user.name || user.username || '?').charAt(0).toUpperCase()

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    router.push('/login')
  }

  const avatarEl = user.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatar} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
  ) : (
    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-galli/30 to-galli-violet/30 text-galli-dark font-bold flex items-center justify-center shrink-0">
      {initial}
    </span>
  )

  const menu = menuOpen && (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
      <div className="absolute bottom-full left-0 mb-2 z-50 w-52 bg-surface border border-border rounded-xl shadow-soft-lg py-1 overflow-hidden">
        <Link
          href={`/${user.username}`}
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <UserCircle className="w-4 h-4" /> View profile
        </Link>
        <Link
          href="/settings"
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Settings className="w-4 h-4" /> Settings
        </Link>
        <div className="border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      </div>
    </>
  )

  if (collapsed) {
    return (
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Account menu"
          className="w-full flex items-center justify-center p-2 rounded-xl border border-border bg-surface hover:bg-muted transition-colors cursor-pointer"
        >
          {avatarEl}
        </button>
        {menu}
      </div>
    )
  }

  return (
    <div className="relative mb-3">
      <div className="p-3 rounded-2xl border border-border bg-surface">
        <div className="flex items-center gap-2.5">
          {avatarEl}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate leading-tight">{user.name || user.username}</p>
            <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
          </div>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Account menu"
            className="p-1.5 -mr-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer shrink-0"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
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
      </div>
      {menu}
    </div>
  )
}
