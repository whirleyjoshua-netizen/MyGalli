// src/components/elements/FlowLinkPicker.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { safeHref } from '@/lib/editor/safe-href'

interface Display { id: string; title: string; slug: string; kind?: string }
type Tab = 'pages' | 'boards' | 'external'

export function FlowLinkPicker({
  value,
  onPick,
}: {
  value?: { url?: string; label?: string }
  onPick: (v: { url?: string; label?: string }) => void
}) {
  const username = useAuthStore((s) => (s as { user?: { username?: string } }).user?.username)
  const [tab, setTab] = useState<Tab>('pages')
  const [displays, setDisplays] = useState<Display[]>([])
  const [ext, setExt] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/displays', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled) setDisplays(Array.isArray(data) ? data : []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const pages = displays.filter((d) => d.kind !== 'collection')
  const boards = displays.filter((d) => d.kind === 'collection')

  const pickDisplay = (d: Display) => {
    if (!username) return
    onPick({ url: `/${username}/${d.slug}`, label: d.title })
  }
  const setExternal = () => {
    const safe = safeHref(ext)
    if (!safe) return
    onPick({ url: safe, label: 'External link' })
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setTab(id) }}
      className={`px-2 py-1 text-xs rounded ${tab === id ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-500'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="rounded-lg border border-slate-200 p-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1">
        {tabBtn('pages', 'Pages')}
        {tabBtn('boards', 'Boards')}
        {tabBtn('external', 'External')}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPick({ url: undefined, label: undefined }) }}
          className="ml-auto px-2 py-1 text-xs rounded text-slate-500 hover:text-destructive"
        >
          None
        </button>
      </div>

      {value?.label && <div className="text-[11px] text-slate-500">Linked: {value.label}</div>}

      {tab === 'external' ? (
        <div className="flex items-center gap-1.5">
          <input
            value={ext}
            onChange={(e) => setExt(e.target.value)}
            placeholder="https://…"
            className="flex-1 text-xs border border-slate-200 rounded px-2 py-1"
          />
          <button type="button" onClick={(e) => { e.stopPropagation(); setExternal() }} className="px-2 py-1 text-xs rounded bg-slate-200">Set link</button>
        </div>
      ) : (
        <div className="max-h-32 overflow-auto space-y-0.5">
          {(tab === 'pages' ? pages : boards).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); pickDisplay(d) }}
              className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-slate-100 truncate"
            >
              {d.title}
            </button>
          ))}
          {(tab === 'pages' ? pages : boards).length === 0 && (
            <div className="text-[11px] text-slate-400 px-2 py-1">Nothing here yet.</div>
          )}
        </div>
      )}
    </div>
  )
}
