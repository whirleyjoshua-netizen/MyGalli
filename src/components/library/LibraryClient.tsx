'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Trophy, FileText, Heart, Sparkles, Library, Store, Search } from 'lucide-react'
import { listTemplates } from '@/lib/templates/registry'
import { listKits } from '@/lib/kits/registry'
import '@/lib/kits/all'
import { useAuthStore } from '@/lib/store'
import { isPro } from '@/lib/plan'
import { useRefreshUser } from '@/lib/use-refresh-user'
import { ProBadge } from '@/components/pro/ProBadge'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'
import { LibraryAppsTab } from '@/components/library/LibraryAppsTab'
import { PageHero } from '@/components/dashboard/PageHero'

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

const KIT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Trophy, FileText, Heart, Sparkles, Library, Store,
}
function LucideIcon({ name, className }: { name?: string; className?: string }) {
  const Cmp = (name && KIT_ICONS[name]) || Library
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
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const handleStarterClick = async (s: Starter) => {
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

  const q = query.trim().toLowerCase()
  const activeStarters = (tab === 'templates' ? TEMPLATE_STARTERS : KIT_STARTERS).filter(
    (s) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
  )

  return (
    <div className="pb-8">
      <PageHero
        icon={<Library className="w-7 h-7 text-primary" />}
        title="Library"
        subtitle="Apps, templates, and kits to build your pages."
        controls={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search library…"
              aria-label="Search library"
              className="w-40 rounded-full border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-56"
            />
          </div>
        }
        tabs={TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-8">
      {tab === 'apps' ? (
        <LibraryAppsTab query={query} />
      ) : (
        <>
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
          {activeStarters.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No {tab} match &ldquo;{query}&rdquo;.</p>
          ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeStarters.map((s) => (
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
                      onClick={() => handleStarterClick(s)}
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
        </>
      )}

      <UpgradePrompt
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature={tab === 'kits' ? 'Kits' : 'Templates'}
      />
      </div>
    </div>
  )
}
