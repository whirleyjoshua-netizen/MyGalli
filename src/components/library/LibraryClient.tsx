'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Layers, Plus } from 'lucide-react'
import { CARD_PROVIDERS } from '@/lib/cards/registry'
import { useAuthStore } from '@/lib/store'
import { isPro } from '@/lib/plan'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'

interface LibItem {
  id: string
  provider: string
  name: string
}

type Tab = 'apps' | 'templates' | 'kits'

const TABS: { id: Tab; label: string; soon?: boolean }[] = [
  { id: 'apps', label: 'Apps' },
  { id: 'templates', label: 'Templates', soon: true },
  { id: 'kits', label: 'Kits', soon: true },
]

export function LibraryClient() {
  const router = useRouter()
  const { user } = useAuthStore()
  const pro = isPro(user)
  const [tab, setTab] = useState<Tab>('apps')
  const [items, setItems] = useState<LibItem[]>([])
  const [loading, setLoading] = useState(true)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  useEffect(() => {
    fetch('/api/card-library')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: LibItem[]) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const remove = async (id: string) => {
    const res = await fetch(`/api/card-library/${id}`, { method: 'DELETE' })
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const use = () => {
    if (!pro) { setUpgradeOpen(true); return }
    router.push('/editor')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Apps, templates, and kits you've collected.</p>
      </header>

      <div className="mb-6 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => !t.soon && setTab(t.id)}
            className={`relative px-3 py-2 text-sm font-semibold transition ${
              tab === t.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            } ${t.soon ? 'cursor-default opacity-60' : ''}`}
          >
            {t.label}
            {t.soon && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">Soon</span>
            )}
            {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-galli" />}
          </button>
        ))}
      </div>

      {tab !== 'apps' ? (
        <p className="py-16 text-center text-muted-foreground">Coming soon.</p>
      ) : loading ? (
        <p className="py-16 text-center text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <Layers className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
          <p className="mb-4 text-sm text-muted-foreground">No Apps in your Library yet.</p>
          <Link
            href="/apps"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Browse Apps
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const provider = CARD_PROVIDERS[item.provider]
            return (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-soft">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{provider?.name ?? item.provider}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={use} className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90">
                    Use on a page
                  </button>
                  <button onClick={() => remove(item.id)} aria-label="Remove" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <UpgradePrompt isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature="Using library Apps" />
    </div>
  )
}
