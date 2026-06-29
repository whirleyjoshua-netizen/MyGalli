'use client'

import { useEffect, useState } from 'react'
import * as Icons from 'lucide-react'
import { listedApps } from '@/lib/cards/registry'
import { useAuthStore } from '@/lib/store'
import { isPro } from '@/lib/plan'
import { useRefreshUser } from '@/lib/use-refresh-user'
import { ProBadge } from '@/components/pro/ProBadge'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] || Icons.Blocks
  return <Cmp className={className} />
}

export function AppsClient() {
  useRefreshUser()
  const { user } = useAuthStore()
  const pro = isPro(user)
  const apps = listedApps()
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<string | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  useEffect(() => {
    fetch('/api/card-library')
      .then((r) => (r.ok ? r.json() : []))
      .then((items: { provider: string }[]) =>
        setAdded(new Set(items.map((i) => i.provider))),
      )
      .catch(() => setAdded(new Set()))
  }, [])

  const addApp = async (id: string, name: string, defaultData: Record<string, unknown>) => {
    if (!pro) {
      setUpgradeOpen(true)
      return
    }
    setPending(id)
    const res = await fetch('/api/card-library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: id, name, data: defaultData }),
    })
    if (res.ok) setAdded((prev) => new Set(prev).add(id))
    else if (res.status === 403) setUpgradeOpen(true)
    setPending(null)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight">Apps</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add My Galli Apps to your Library, then drop them on any page.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {apps.map((app) => {
          const isComingSoon = app.status === 'coming-soon'
          const isAdded = added.has(app.id)
          return (
            <div key={app.id} className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-soft">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-galli/15 text-galli-dark">
                  <LucideIcon name={app.icon} className="h-5 w-5" />
                </span>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{app.name}</h3>
                  {!pro && !isComingSoon && <ProBadge />}
                </div>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{app.description}</p>
              <div className="mt-4">
                {isComingSoon ? (
                  <span className="inline-flex rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    Coming soon
                  </span>
                ) : isAdded ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-galli/15 px-3 py-1.5 text-xs font-semibold text-galli-dark">
                    <Icons.Check className="h-3.5 w-3.5" /> In Library
                  </span>
                ) : (
                  <button
                    onClick={() => addApp(app.id, app.name, app.defaultData)}
                    disabled={pending === app.id}
                    aria-busy={pending === app.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-60"
                  >
                    <Icons.Plus className="h-3.5 w-3.5" />
                    {pending === app.id ? 'Adding…' : 'Add to Library'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <UpgradePrompt isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature="Adding Apps" />
    </div>
  )
}
