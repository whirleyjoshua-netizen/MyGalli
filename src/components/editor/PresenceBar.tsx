'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'

interface Editor {
  id: string
  name: string | null
  avatar: string | null
}

export function PresenceBar({ displayId }: { displayId: string }) {
  const { user } = useAuthStore()
  const [editors, setEditors] = useState<Editor[]>([])

  useEffect(() => {
    let alive = true
    const beat = async () => {
      try {
        const res = await fetch(`/api/displays/${displayId}/presence`, { method: 'POST' })
        if (res.ok) {
          const data = await res.json()
          if (alive) setEditors(Array.isArray(data.active) ? data.active : [])
        }
      } catch {
        /* noop */
      }
    }
    beat()
    const interval = setInterval(beat, 8000)
    return () => { alive = false; clearInterval(interval) }
  }, [displayId])

  // Show others (exclude self); only render when someone else is here
  const others = editors.filter((e) => e.id !== user?.id)
  if (others.length === 0) return null

  const initial = (e: Editor) => (e.name || '?').charAt(0).toUpperCase()

  return (
    <div className="flex items-center gap-1.5 pr-1" title={`${others.map((o) => o.name || 'Someone').join(', ')} editing`}>
      <div className="flex -space-x-2">
        {others.slice(0, 3).map((e) =>
          e.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={e.id} src={e.avatar} alt="" className="w-7 h-7 rounded-full border-2 border-background object-cover" />
          ) : (
            <span key={e.id} className="w-7 h-7 rounded-full border-2 border-background bg-galli-violet/20 text-galli-violet text-xs font-bold flex items-center justify-center">
              {initial(e)}
            </span>
          ),
        )}
      </div>
      <span className="text-xs text-muted-foreground hidden sm:inline">editing</span>
    </div>
  )
}
