// src/components/dashboard/NotificationBell.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { formatNotification } from '@/lib/notifications-format'
import { timeAgo } from '@/lib/time-ago'

interface NotificationRow {
  id: string
  type: string
  actorName: string
  actorAvatar: string | null
  entityUrl: string | null
  contextText: string | null
  read: boolean
  createdAt: string
}

export function NotificationBell() {
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    const load = () => {
      fetch('/api/notifications/unread-count')
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((d) => { if (active) setUnread(d.count || 0) })
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 45000)
    return () => { active = false; clearInterval(t) }
  }, [])

  const openMenu = async () => {
    setOpen(true)
    setLoading(true)
    try {
      const r = await fetch('/api/notifications')
      const d = r.ok ? await r.json() : { notifications: [] }
      setItems(d.notifications || [])
      if (unread > 0) {
        await fetch('/api/notifications/read', { method: 'POST' })
        setUnread(0)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        aria-label="Notifications"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="relative w-10 h-10 rounded-full border border-border bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-galli-violet text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 max-w-[90vw] bg-surface border border-border rounded-xl shadow-soft-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border text-sm font-semibold">Notifications</div>
            {/* Cap against the viewport, not just a fixed height, so the list
                scrolls instead of running off the bottom of short windows. */}
            <div className="max-h-[min(24rem,calc(100vh-12rem))] overflow-y-auto">
              {loading ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up 🎉</p>
              ) : (
                items.map((n) => {
                  const initial = (n.actorName || '?').charAt(0).toUpperCase()
                  const body = (
                    <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted transition-colors">
                      {n.actorAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.actorAvatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-primary/15 text-primary font-bold text-sm flex items-center justify-center shrink-0">{initial}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground leading-snug">{formatNotification(n)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  )
                  return n.entityUrl ? (
                    <Link key={n.id} href={n.entityUrl} onClick={() => setOpen(false)}>{body}</Link>
                  ) : (
                    <div key={n.id}>{body}</div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
