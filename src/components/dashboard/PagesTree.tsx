'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Boxes } from 'lucide-react'

interface PageRow { id: string; title: string }
interface HubRow { id: string; title: string; displayId: string | null }

/**
 * The page tree shown under the "Gallery" nav item in the desktop rail: every
 * page, with any Hubs created on it nested as child branches (click a hub → its
 * editor, no page detour).
 */
export function PagesTree({ onNavigate }: { onNavigate?: () => void }) {
  const [pages, setPages] = useState<PageRow[]>([])
  const [hubsByPage, setHubsByPage] = useState<Record<string, HubRow[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([
      fetch('/api/displays').then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch('/api/hubs').then((r) => (r.ok ? r.json() : { hubs: [] })).catch(() => ({ hubs: [] })),
    ]).then(([displays, hubData]) => {
      if (!active) return
      const pageList = (Array.isArray(displays) ? displays : []).filter((d: { kind?: string }) => d.kind !== 'collection')
      const hubs: HubRow[] = Array.isArray(hubData?.hubs) ? hubData.hubs : []
      const byPage: Record<string, HubRow[]> = {}
      for (const h of hubs) { if (h.displayId) (byPage[h.displayId] ||= []).push(h) }
      setPages(pageList.map((d: { id: string; title: string }) => ({ id: d.id, title: d.title })))
      setHubsByPage(byPage)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  if (loading) return <p className="pl-6 py-1.5 text-xs text-muted-foreground">Loading…</p>
  if (pages.length === 0) return <p className="pl-6 py-1.5 text-xs text-muted-foreground">No pages yet.</p>

  return (
    <div className="mt-0.5 ml-4 pl-2 border-l border-border flex flex-col gap-0.5">
      {pages.map((page) => {
        const hubs = hubsByPage[page.id] || []
        return (
          <div key={page.id}>
            <Link
              href={`/editor?id=${page.id}`}
              onClick={onNavigate}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{page.title || 'Untitled'}</span>
            </Link>
            {hubs.map((hub) => (
              <Link
                key={hub.id}
                href={`/hubs/${hub.id}`}
                onClick={onNavigate}
                className="flex items-center gap-2 pl-7 pr-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Boxes className="w-3.5 h-3.5 shrink-0 text-primary" />
                <span className="truncate">{hub.title || 'Hub'}</span>
              </Link>
            ))}
          </div>
        )
      })}
    </div>
  )
}
