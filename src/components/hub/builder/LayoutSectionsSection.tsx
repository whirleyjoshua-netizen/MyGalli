'use client'

import { ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import type { HubConfig, HubSidebarKey } from '@/lib/types/hub-config'

const LABELS: Record<HubSidebarKey, string> = { members: 'Members', resources: 'Resources', video: 'Video hero' }

export function LayoutSectionsSection({ config, onChange }: { config: HubConfig; onChange: (c: HubConfig) => void }) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= config.sidebar.length) return
    const sidebar = [...config.sidebar]
    ;[sidebar[i], sidebar[j]] = [sidebar[j], sidebar[i]]
    onChange({ ...config, sidebar })
  }
  const toggle = (i: number) => {
    const sidebar = config.sidebar.map((w, k) => (k === i ? { ...w, enabled: !w.enabled } : w))
    onChange({ ...config, sidebar })
  }
  const setFeed = (patch: Partial<HubConfig['feed']>) => onChange({ ...config, feed: { ...config.feed, ...patch } })

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <h2 className="text-lg font-bold">Sidebar sections</h2>
        <p className="mb-3 text-sm text-muted-foreground">Reorder and toggle what shows in the community sidebar.</p>
        <div className="space-y-2">
          {config.sidebar.map((w, i) => (
            <div key={w.key} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <GripVertical className="h-4 w-4 text-muted-foreground/50" />
              <span className="flex-1 text-sm font-medium">{LABELS[w.key]}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-muted-foreground disabled:opacity-30 hover:bg-muted"><ArrowUp className="h-4 w-4" /></button>
              <button onClick={() => move(i, 1)} disabled={i === config.sidebar.length - 1} className="rounded p-1 text-muted-foreground disabled:opacity-30 hover:bg-muted"><ArrowDown className="h-4 w-4" /></button>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" checked={w.enabled} onChange={() => toggle(i)} className="peer sr-only" />
                <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-galli after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">Feed</h2>
        <div className="mt-3 space-y-3">
          <Row label="Allow members to post" checked={config.feed.composerEnabled} onChange={(v) => setFeed({ composerEnabled: v })} />
          <div>
            <label className="mb-1 block text-sm font-medium">Empty-state message</label>
            <input value={config.feed.emptyStateText ?? ''} onChange={(e) => setFeed({ emptyStateText: e.target.value })} placeholder="No posts yet. Be the first to share something." maxLength={200} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
          </div>
        </div>
      </section>
    </div>
  )
}

function Row({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
      <span className="text-sm">{label}</span>
      <span className="relative inline-flex cursor-pointer items-center">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-5 w-9 rounded-full bg-muted peer-checked:bg-galli after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
      </span>
    </label>
  )
}
