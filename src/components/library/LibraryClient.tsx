'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Layers, Plus, Trophy, FileText, Heart, Sparkles, Library, Store } from 'lucide-react'
import { CARD_PROVIDERS } from '@/lib/cards/registry'
import { listTemplates } from '@/lib/templates/registry'
import { listKits } from '@/lib/kits/registry'
import '@/lib/kits/all'
import { useAuthStore } from '@/lib/store'
import { isPro } from '@/lib/plan'
import { useRefreshUser } from '@/lib/use-refresh-user'
import { ProBadge } from '@/components/pro/ProBadge'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'

interface LibItem {
  id: string
  provider: string
  name: string
}

interface Starter {
  kind: 'template' | 'kit'
  id: string
  name: string
  description: string
  pro?: boolean
  emoji?: string
  iconName?: string
  gradient: string
}

type Tab = 'apps' | 'templates' | 'kits'

const TABS: { id: Tab; label: string }[] = [
  { id: 'apps', label: 'Apps' },
  { id: 'templates', label: 'Templates' },
  { id: 'kits', label: 'Kits' },
]

// Explicit map of the icons the 7 kits use — avoids bundling all of lucide-react.
const KIT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Trophy, FileText, Heart, Sparkles, Library, Store,
}

function LucideIcon({ name, className }: { name?: string; className?: string }) {
  const Cmp = (name && KIT_ICONS[name]) || Layers
  return <Cmp className={className} />
}

const TEMPLATE_STARTERS: Starter[] = listTemplates().map((t) => ({
  kind: 'template', id: t.id, name: t.name, description: t.description, pro: t.pro, emoji: t.emoji, gradient: t.gradient,
}))
const KIT_STARTERS: Starter[] = listKits().map((k) => ({
  kind: 'kit', id: k.id, name: k.name, description: k.description, pro: k.pro, iconName: k.icon, gradient: 'from-galli/20 to-galli-violet/15',
}))

export function LibraryClient() {
  useRefreshUser()
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuthStore()
  const pro = isPro(user)
  const requested = params.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(
    requested === 'templates' || requested === 'kits' ? requested : 'apps',
  )
  const [items, setItems] = useState<LibItem[]>([])
  const [loading, setLoading] = useState(true)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/card-library')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: LibItem[]) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const remove = async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/card-library/${id}`, { method: 'DELETE' })
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id))
      else setError('Could not remove that item. Please try again.')
    } catch {
      setError('Could not remove that item. Please try again.')
    }
  }

  const handleUseApp = () => {
    if (!pro) { setUpgradeOpen(true); return }
    router.push('/editor')
  }

  const useStarter = async (s: Starter) => {
    if (s.pro && !pro) { setUpgradeOpen(true); return }
    setCreating(s.id)
    setError(null)
    try {
      const res = await fetch('/api/displays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `My ${s.name}`,
          ...(s.kind === 'template' ? { templateId: s.id } : { kitId: s.id }),
        }),
      })
      if (res.ok) {
        const display = await res.json()
        router.push(`/editor?id=${display.id}`)
        return
      }
      if (res.status === 403) { setUpgradeOpen(true); return }
      setError('Could not create a page from that. Please try again.')
    } catch {
      setError('Could not create a page from that. Please try again.')
    } finally {
      setCreating(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Apps, templates, and kits to build your pages.</p>
      </header>

      <div className="mb-6 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2 text-sm font-semibold transition ${
              tab === t.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-galli" />}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {tab === 'apps' ? (
        loading ? (
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
                    <button onClick={handleUseApp} className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90">
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
        )
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(tab === 'templates' ? TEMPLATE_STARTERS : KIT_STARTERS).map((s) => (
            <div key={s.id} className="flex flex-col rounded-2xl border border-border bg-surface shadow-soft">
              <div className={`flex h-28 items-center justify-center rounded-t-2xl bg-gradient-to-br ${s.gradient} text-4xl`}>
                {s.emoji ? <span>{s.emoji}</span> : <LucideIcon name={s.iconName} className="h-9 w-9 text-galli-dark" />}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{s.name}</h3>
                  {s.pro && !pro && <ProBadge />}
                </div>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
                <div className="mt-4">
                  <button
                    onClick={() => useStarter(s)}
                    disabled={creating === s.id}
                    aria-busy={creating === s.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {creating === s.id ? 'Creating…' : 'Use'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <UpgradePrompt
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature={tab === 'kits' ? 'Kits' : tab === 'templates' ? 'Templates' : 'Library Apps'}
      />
    </div>
  )
}
