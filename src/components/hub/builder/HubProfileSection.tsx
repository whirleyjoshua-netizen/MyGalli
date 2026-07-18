'use client'

type ProfileHub = {
  id: string; title: string; tagline: string | null; description: string | null
  coverImage: string | null; heroVideoUrl: string | null; slug: string
  published: boolean; community: boolean; version: number; username: string
}

export function HubProfileSection({ hub, onField }: { hub: ProfileHub; onField: (k: any, v: any) => void }) {
  return <div className="text-sm text-muted-foreground">Coming in the next step</div>
}
