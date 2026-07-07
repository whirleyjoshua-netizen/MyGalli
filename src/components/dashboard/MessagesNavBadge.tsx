'use client'

import { useEffect, useState } from 'react'

export function MessagesNavBadge() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    const load = () => fetch('/api/messages/unread-count', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => { if (!cancelled) setCount(Number(d.count) || 0) })
      .catch(() => {})
    load()
    const t = setInterval(load, 45000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])
  if (count <= 0) return null
  return <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">{count > 99 ? '99+' : count}</span>
}
