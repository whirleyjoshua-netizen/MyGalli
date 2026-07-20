'use client'

import { useState } from 'react'
import type { HubConfig, HubUtilityKey } from '@/lib/types/hub-config'
import { HubResourcesModal } from './HubResourcesModal'

const LABELS: Record<HubUtilityKey, string> = { notes: 'Notes', ai: 'Kollab AI', tools: 'Tools' }
const SUBS: Record<HubUtilityKey, string> = {
  notes: 'Pinned notes for your community',
  ai: 'Reserved for Kollab AI — coming soon',
  tools: 'Quick actions, visible only to you',
}

export function WidgetsToolsSection({ config, onChange, hubId }: { config: HubConfig; onChange: (c: HubConfig) => void; hubId: string }) {
  const [manageResources, setManageResources] = useState(false)

  const toggle = (i: number) => {
    const utility = config.utility.map((w, k) => (k === i ? { ...w, enabled: !w.enabled } : w))
    onChange({ ...config, utility })
  }

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <h2 className="text-lg font-bold">Utility strip</h2>
        <p className="mb-3 text-sm text-muted-foreground">The row of cards above your hub header.</p>
        <div className="space-y-2">
          {config.utility.map((w, i) => (
            <div key={w.key} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{LABELS[w.key]}</p>
                <p className="text-xs text-muted-foreground">{SUBS[w.key]}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" checked={w.enabled} onChange={() => toggle(i)} className="peer sr-only" />
                <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-galli after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">Files &amp; links</h2>
        <p className="mb-3 text-sm text-muted-foreground">Resources shown in your community sidebar.</p>
        <button onClick={() => setManageResources(true)} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">Manage files &amp; links</button>
      </section>

      {manageResources && <HubResourcesModal hubId={hubId} onClose={() => setManageResources(false)} />}
    </div>
  )
}
