'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react'
import { useHubAutosave } from '@/hooks/useHubAutosave'
import { sanitizeHubConfig } from '@/lib/hub-config'
import type { HubConfig } from '@/lib/types/hub-config'
import { HubBuilderNav, type BuilderSection } from './HubBuilderNav'
import { HubBuilderSaveBar } from './HubBuilderSaveBar'
import { HubBuilderPreview } from './HubBuilderPreview'
import { LayoutSectionsSection } from './LayoutSectionsSection'
import { HubProfileSection } from './HubProfileSection'
import { HubSettingsSection } from './HubSettingsSection'
import { CommunitySettingsSection } from './CommunitySettingsSection'
import { WidgetsToolsSection } from './WidgetsToolsSection'

type HubState = {
  id: string; title: string; tagline: string | null; description: string | null
  coverImage: string | null; heroVideoUrl: string | null; slug: string
  published: boolean; community: boolean; version: number; username: string
}

export function HubBuilder({ hubId }: { hubId: string }) {
  const [hub, setHub] = useState<HubState | null>(null)
  const [config, setConfig] = useState<HubConfig | null>(null)
  const [fields, setFields] = useState<Partial<HubState>>({})
  const [section, setSection] = useState<BuilderSection>('layout')

  useEffect(() => {
    fetch(`/api/hubs/${hubId}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d?.hub) return
      const h = d.hub
      setHub({ id: h.id, title: h.title, tagline: h.tagline ?? null, description: h.description ?? null, coverImage: h.coverImage ?? null, heroVideoUrl: h.heroVideoUrl ?? null, slug: h.slug, published: !!h.published, community: !!h.community, version: h.version ?? 0, username: d.username ?? h.user?.username ?? '' })
      setConfig(sanitizeHubConfig(h.config))
    })
  }, [hubId])

  const merged = hub ? { ...hub, ...fields } : null
  const payload = merged && config ? {
    title: merged.title, tagline: merged.tagline, description: merged.description,
    coverImage: merged.coverImage, heroVideoUrl: merged.heroVideoUrl, published: merged.published,
    config,
  } : {}
  const autosave = useHubAutosave({ hubId, payload, version: hub?.version ?? 0, enabled: !!merged })

  if (!merged || !config) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }

  const setField = <K extends keyof HubState>(k: K, v: HubState[K]) => setFields((f) => ({ ...f, [k]: v }))

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to My Galli</Link>
          <span className="text-sm font-semibold">Editing: {merged.title}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${merged.published ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{merged.published ? 'Published' : 'Draft'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${merged.username}/hub/${merged.slug}`} target="_blank" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm">View live <ExternalLink className="h-3.5 w-3.5" /></Link>
          <button onClick={() => setField('published', !merged.published)} className="rounded-lg bg-galli px-4 py-1.5 text-sm font-medium text-white">{merged.published ? 'Unpublish' : 'Publish'}</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-border bg-surface p-3">
          <HubBuilderNav active={section} onSelect={setSection} />
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          {section === 'settings' && <HubSettingsSection hub={merged} onField={setField} />}
          {section === 'layout' && <LayoutSectionsSection config={config} onChange={setConfig} hubId={merged.id} />}
          {section === 'widgets' && <WidgetsToolsSection config={config} onChange={setConfig} hubId={merged.id} />}
          {section === 'profile' && <HubProfileSection hub={merged} onField={setField} />}
          {section === 'community' && <CommunitySettingsSection config={config} onChange={setConfig} />}
        </main>
        <aside className="hidden w-[420px] shrink-0 overflow-y-auto border-l border-border bg-muted/30 p-4 xl:block">
          <HubBuilderPreview hub={merged} config={config} />
        </aside>
      </div>

      <HubBuilderSaveBar saving={autosave.saving} dirty={autosave.dirty} lastSaved={autosave.lastSaved} conflict={autosave.conflict} />
    </div>
  )
}
