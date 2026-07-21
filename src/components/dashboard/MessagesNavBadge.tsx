'use client'

import { useEffect, useState } from 'react'

function fetchCount(url: string): Promise<number | null> {
  return fetch(url, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d ? Number(d.count) || 0 : null))
    .catch(() => null)
}

export function MessagesNavBadge() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    const load = () => {
      // Both endpoints are fetched independently so a failure or an
      // unauthenticated response from one still lets the other's count show.
      Promise.all([
        fetchCount('/api/messages/unread-count'),
        fetchCount('/api/dm/unread-count'),
      ]).then(([visitor, dm]) => {
        if (cancelled) return
        setCount((visitor ?? 0) + (dm ?? 0))
      })
    }
    load()
    const t = setInterval(load, 45000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])
  if (count <= 0) return null
  return <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">{count > 99 ? '99+' : count}</span>
}
