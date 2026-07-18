'use client'

import type { HubConfig } from '@/lib/types/hub-config'

export function CommunitySettingsSection({ config, onChange }: { config: HubConfig; onChange: (c: HubConfig) => void }) {
  const set = (whoCanPost: HubConfig['access']['whoCanPost']) =>
    onChange({ ...config, access: { ...config.access, whoCanPost } })

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-bold">Community settings</h2>
      <p className="text-sm text-muted-foreground">Who can create posts in this community?</p>
      <div className="space-y-2">
        {(['members', 'owner-only'] as const).map((opt) => (
          <label
            key={opt}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
              config.access.whoCanPost === opt ? 'border-galli bg-galli/5' : 'border-border'
            }`}
          >
            <input
              type="radio"
              name="whoCanPost"
              checked={config.access.whoCanPost === opt}
              onChange={() => set(opt)}
              className="accent-galli"
            />
            <span className="text-sm">
              {opt === 'members' ? 'All members can post' : 'Only owner & collaborators can post'}
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Members can always read, react, and comment.</p>
    </div>
  )
}
