'use client'

import type { HubConfig } from '@/lib/types/hub-config'
import { HUB_THEMES } from '@/lib/hub-themes'

export function AppearanceSection({
  config, onChange,
}: {
  config: HubConfig
  onChange: (c: HubConfig) => void
}) {
  const active = config.appearance?.theme ?? 'galli'

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-bold">Appearance</h2>
      <p className="text-sm text-muted-foreground">Pick a colour theme for your hub.</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {HUB_THEMES.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={t.key === active}
            onClick={() => onChange({ ...config, appearance: { theme: t.key } })}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
              t.key === active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
            }`}
          >
            {/* Swatches use inline hsl() rather than Tailwind classes: these must
                show each preset's own colours, not the currently active theme. */}
            <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
              <span className="h-6 w-6 rounded-full border-2 border-surface" style={{ backgroundColor: `hsl(${t.primary})` }} />
              <span className="h-6 w-6 rounded-full border-2 border-surface" style={{ backgroundColor: `hsl(${t.accent})` }} />
            </span>
            <span className="text-sm font-medium">{t.label}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        The theme applies to your hub&apos;s public page, including its Files and Pages tabs.
      </p>
    </div>
  )
}
