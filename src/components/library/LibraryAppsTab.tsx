'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Check, Trash2, ShieldCheck, Share2, Blocks } from 'lucide-react'
import { listedApps } from '@/lib/cards/registry'
import { useAuthStore } from '@/lib/store'
import { isPro } from '@/lib/plan'
import { ProBadge } from '@/components/pro/ProBadge'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'

interface LibItem {
  id: string
  provider: string
  name: string
}

// Explicit map of the icons listed providers use — avoids bundling all of lucide.
const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck,
  Share2,
}
function ProviderIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = PROVIDER_ICONS[name] || Blocks
  return <Cmp className={className} />
}

export function LibraryAppsTab() {
  const router = useRouter()
  const { user } = useAuthStore()
  const pro = isPro(user)
  const apps = listedApps()
  const [items, setItems] = useState<LibItem[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/card-library')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: LibItem[]) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
  }, [])

  const itemsFor = (provider: string) => items.filter((i) => i.provider === provider)

  const add = async (id: string, name: string, defaultData: Record<string, unknown>) => {
    if (!pro) { setUpgradeOpen(true); return }
    setPending(id)
    setError(null)
    try {
      const res = await fetch('/api/card-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: id, name, data: defaultData }),
      })
      if (res.ok) {
        const item = await res.json()
        setItems((prev) => [...prev, item])
      } else if (res.status === 403) {
        setUpgradeOpen(true)
      } else {
        setError('Could not add that app. Please try again.')
      }
    } catch {
      setError('Could not add that app. Please try again.')
    } finally {
      setPending(null)
    }
  }

  const remove = async (provider: string) => {
    setError(null)
    const mine = itemsFor(provider)
    try {
      for (const it of mine) {
        const res = await fetch(`/api/card-library/${it.id}`, { method: 'DELETE' })
        if (!res.ok) { setError('Could not remove that app. Please try again.'); return }
      }
      setItems((prev) => prev.filter((i) => i.provider !== provider))
    } catch {
      setError('Could not remove that app. Please try again.')
    }
  }

  const use = () => {
    if (!pro) { setUpgradeOpen(true); return }
    router.push('/editor')
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {apps.map((app) => {
          const isComingSoon = app.status === 'coming-soon'
          const added = itemsFor(app.id).length > 0
          return (
            <div key={app.id} className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-soft">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-galli/15 text-galli-dark">
                  <ProviderIcon name={app.icon} className="h-5 w-5" />
                </span>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{app.name}</h3>
                  {!pro && !isComingSoon && <ProBadge />}
                </div>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{app.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {isComingSoon ? (
                  <span className="inline-flex rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    Coming soon
                  </span>
                ) : added ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-galli/15 px-3 py-1.5 text-xs font-semibold text-galli-dark">
                      <Check className="h-3.5 w-3.5" /> In Library
                    </span>
                    <button onClick={use} className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90">
                      Use on a page
                    </button>
                    <button onClick={() => remove(app.id)} aria-label={`Remove ${app.name}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => add(app.id, app.name, app.defaultData)}
                    disabled={pending === app.id}
                    aria-busy={pending === app.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {pending === app.id ? 'Adding…' : 'Add to Library'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <UpgradePrompt isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature="Library Apps" />
    </div>
  )
}
