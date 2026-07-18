'use client'

type SettingsHub = {
  id: string; title: string; tagline: string | null; description: string | null
  coverImage: string | null; heroVideoUrl: string | null; slug: string
  published: boolean; community: boolean; version: number; username: string
}

export function HubSettingsSection({ hub, onField }: { hub: SettingsHub; onField: (k: any, v: any) => void }) {
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-bold">Hub settings</h2>
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">Status: {hub.published ? 'Published' : 'Draft'}</p>
        <p className="text-xs text-muted-foreground">
          {hub.published ? "Your hub is live and visible to everyone." : 'Only you can see this hub.'}
        </p>
        <button
          onClick={() => onField('published', !hub.published)}
          className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm"
        >
          {hub.published ? 'Unpublish' : 'Publish'}
        </button>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          value={hub.description ?? ''}
          onChange={(e) => onField('description', e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
        />
      </div>
    </div>
  )
}
