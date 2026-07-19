'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Check, Trash2, ShieldCheck, Share2, Blocks, Puzzle, Link2, Users, Sprout, HelpCircle } from 'lucide-react'
import { listedApps } from '@/lib/cards/registry'
import { useAuthStore } from '@/lib/store'
import { isPro } from '@/lib/plan'
import { ProBadge } from '@/components/pro/ProBadge'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'
import { AppIllustration, type AppIllustrationVariant } from './AppIllustration'

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

// Featured presentation config (chips + Pro flag + illustration are UI-only,
// not in the registry). Order here is the display order.
const FEATURED: { id: string; variant: AppIllustrationVariant; pro: boolean; chips: string[] }[] = [
  { id: 'vouch', variant: 'vouch', pro: true, chips: ['Trusted', 'Secure', 'Easy to use'] },
  { id: 'kollabshare', variant: 'kollabshare', pro: false, chips: [] },
]

const MORE = [
  { icon: Puzzle, title: 'Powerful Tools', text: "Apps that extend what's possible." },
  { icon: Link2, title: 'Seamless Integrations', text: 'Connect and collaborate effortlessly.' },
  { icon: Users, title: 'Built for Creators', text: 'Designed to help you create and scale.' },
  { icon: Sprout, title: 'Always Growing', text: 'New additions every week.' },
]

export function LibraryAppsTab({ query = '' }: { query?: string }) {
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

  const q = query.trim().toLowerCase()
  const matches = (a: { name: string; description?: string }) =>
    !q || a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q)

  const featuredIds = new Set(FEATURED.map((f) => f.id))
  const featured = FEATURED
    .map((f) => ({ ...f, app: apps.find((a) => a.id === f.id) }))
    .filter((f): f is typeof f & { app: NonNullable<typeof f.app> } => Boolean(f.app) && matches(f.app!))
  const rest = apps.filter((a) => !featuredIds.has(a.id) && matches(a))
  const nothing = q !== '' && featured.length === 0 && rest.length === 0

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Featured */}
      {featured.length > 0 && (
        <section className="mb-8">
          {!q && (
            <div className="mb-4">
              <h2 className="text-lg font-bold">Featured</h2>
              <p className="text-sm text-muted-foreground">Curated tools and integrations to enhance your workspace.</p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {featured.map((f) => {
              const app = f.app
              const isComingSoon = app.status === 'coming-soon'
              const added = itemsFor(app.id).length > 0
              return (
                <div key={app.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-soft sm:flex-row sm:items-stretch">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-galli/15 text-galli-dark">
                        <ProviderIcon name={app.icon} className="h-5 w-5" />
                      </span>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold">{app.name}</h3>
                        {f.pro && <ProBadge />}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{app.description}</p>
                    {f.chips.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                        {f.chips.map((c) => (
                          <span key={c} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Check className="h-3.5 w-3.5 text-galli" /> {c}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-auto pt-4">
                      {isComingSoon ? (
                        <span className="inline-flex rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                          Coming soon
                        </span>
                      ) : added ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-galli/15 px-3 py-1.5 text-xs font-semibold text-galli-dark">
                            <Check className="h-3.5 w-3.5" /> In Library
                          </span>
                          <button onClick={use} className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90">
                            Use on a page
                          </button>
                          <button onClick={() => remove(app.id)} aria-label={`Remove ${app.name}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => add(app.id, app.name, app.defaultData)}
                          disabled={pending === app.id}
                          aria-busy={pending === app.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-60"
                        >
                          <Plus className="h-4 w-4" />
                          {pending === app.id ? 'Adding…' : 'Add to Library'}
                        </button>
                      )}
                    </div>
                  </div>
                  <AppIllustration variant={f.variant} className="min-h-[150px] shrink-0 sm:w-2/5" />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Any additional listed apps (beyond the featured set) */}
      {rest.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rest.map((app) => {
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
                    <span className="inline-flex rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">Coming soon</span>
                  ) : added ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-galli/15 px-3 py-1.5 text-xs font-semibold text-galli-dark">
                        <Check className="h-3.5 w-3.5" /> In Library
                      </span>
                      <button onClick={use} className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90">Use on a page</button>
                      <button onClick={() => remove(app.id)} aria-label={`Remove ${app.name}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </>
                  ) : (
                    <button onClick={() => add(app.id, app.name, app.defaultData)} disabled={pending === app.id} aria-busy={pending === app.id} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-60">
                      <Plus className="h-3.5 w-3.5" /> {pending === app.id ? 'Adding…' : 'Add to Library'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {nothing && (
        <p className="py-10 text-center text-sm text-muted-foreground">No apps match &ldquo;{query}&rdquo;.</p>
      )}

      {/* Static sections hide while searching */}
      {!q && (
        <>
          <section className="mb-6 rounded-2xl border border-border bg-surface/60 p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-galli/15 text-galli-dark">
                <Blocks className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold">More coming soon!</h2>
                <p className="text-sm text-muted-foreground">We&apos;re adding new apps, templates, and kits regularly to help you build and grow.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {MORE.map((m) => (
                <div key={m.title}>
                  <m.icon className="mb-2 h-5 w-5 text-galli" />
                  <h3 className="text-sm font-bold">{m.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{m.text}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-5 shadow-soft sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <HelpCircle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold">Can&apos;t find what you&apos;re looking for?</h3>
                <p className="text-sm text-muted-foreground">A developer portal to build and request apps is on the way.</p>
              </div>
            </div>
            <button
              disabled
              className="shrink-0 cursor-not-allowed rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground"
            >
              Request an App · Coming soon
            </button>
          </div>
        </>
      )}

      <UpgradePrompt isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature="Library Apps" />
    </div>
  )
}
