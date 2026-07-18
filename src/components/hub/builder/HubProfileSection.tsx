'use client'

type ProfileHub = {
  id: string; title: string; tagline: string | null; description: string | null
  coverImage: string | null; heroVideoUrl: string | null; slug: string
  published: boolean; community: boolean; version: number; username: string
}

export function HubProfileSection({ hub, onField }: { hub: ProfileHub; onField: (k: 'title' | 'tagline' | 'heroVideoUrl', v: string) => void }) {
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-bold">Hub profile</h2>
      <Field label="Name">
        <input
          value={hub.title}
          onChange={(e) => onField('title', e.target.value)}
          className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Tagline">
        <input
          value={hub.tagline ?? ''}
          onChange={(e) => onField('tagline', e.target.value)}
          placeholder="This is a test of the Community Network"
          className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Hero video URL">
        <input
          value={hub.heroVideoUrl ?? ''}
          onChange={(e) => onField('heroVideoUrl', e.target.value)}
          placeholder="YouTube, Vimeo, or .mp4"
          className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Public URL">
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          galli.page/{hub.username}/hub/{hub.slug}
        </div>
      </Field>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  )
}
