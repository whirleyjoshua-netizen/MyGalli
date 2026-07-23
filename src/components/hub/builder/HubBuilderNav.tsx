'use client'

import { Settings, LayoutGrid, User, Users, Palette, Boxes, Search, ShieldAlert } from 'lucide-react'

export type BuilderSection = 'settings' | 'layout' | 'profile' | 'community' | 'widgets' | 'moderation' | 'appearance'

const ITEMS: { key: BuilderSection; label: string; sub: string; icon: any; enabled: boolean }[] = [
  { key: 'settings', label: 'Hub Settings', sub: 'Manage the basics', icon: Settings, enabled: true },
  { key: 'layout', label: 'Layout & Sections', sub: 'Customize what appears', icon: LayoutGrid, enabled: true },
  { key: 'widgets', label: 'Widgets & Tools', sub: 'Top utility widgets', icon: Boxes, enabled: true },
  { key: 'profile', label: 'Hub Profile', sub: "Your hub's identity", icon: User, enabled: true },
  { key: 'appearance', label: 'Appearance', sub: 'Themes, colors & visuals', icon: Palette, enabled: true },
  { key: 'community', label: 'Community Settings', sub: 'Permissions & access', icon: Users, enabled: true },
  { key: 'moderation', label: 'Moderation', sub: 'Reports & bans', icon: ShieldAlert, enabled: true },
]
const SOON: { label: string; sub: string; icon: any }[] = [
  { label: 'SEO & Sharing', sub: 'Optimize & share', icon: Search },
]

export function HubBuilderNav({ active, onSelect }: { active: BuilderSection; onSelect: (s: BuilderSection) => void }) {
  return (
    <nav className="space-y-1">
      {ITEMS.map((it) => (
        <button
          key={it.key}
          onClick={() => onSelect(it.key)}
          className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${active === it.key ? 'bg-galli/10 text-foreground' : 'text-muted-foreground hover:bg-muted'}`}
        >
          <it.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span><span className="block text-sm font-medium">{it.label}</span><span className="block text-xs text-muted-foreground">{it.sub}</span></span>
        </button>
      ))}
      <div className="pt-2">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">Coming soon</p>
        {SOON.map((it) => (
          <div key={it.label} className="flex cursor-not-allowed items-start gap-3 rounded-xl px-3 py-2.5 opacity-50">
            <it.icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span><span className="block text-sm font-medium">{it.label}</span><span className="block text-xs">{it.sub}</span></span>
          </div>
        ))}
      </div>
    </nav>
  )
}
