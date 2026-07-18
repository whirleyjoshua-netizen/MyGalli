'use client'

import Link from 'next/link'
import { UserPlus, Check, Share2, Pencil } from 'lucide-react'

export function CommunityHeader({
  title, tagline, ownerUsername, coverImage, memberAvatars, counts, joined, isPrivileged, onToggleJoin, sharePath, editHref,
}: {
  title: string
  tagline: string | null
  ownerUsername: string
  coverImage: string | null
  memberAvatars: { avatar: string | null }[]
  counts: { posts: number; members: number; resources: number; events: number }
  joined: boolean
  isPrivileged: boolean
  onToggleJoin: () => void
  sharePath: string
  editHref?: string
}) {
  async function share() {
    const url = `${window.location.origin}${sharePath}`
    try {
      if (navigator.share) await navigator.share({ title, url })
      else { await navigator.clipboard.writeText(url); alert('Link copied') }
    } catch { /* cancelled */ }
  }
  const tiles: [string, number][] = [['Posts', counts.posts], ['Members', counts.members], ['Resources', counts.resources], ['Events', counts.events]]
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-galli/30 to-galli-violet/30">
        {coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {tagline && <p className="mt-0.5 text-muted-foreground">{tagline}</p>}
        <p className="mt-0.5 text-sm text-primary">by @{ownerUsername}</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex -space-x-2">
            {memberAvatars.slice(0, 4).map((m, i) => (
              <span key={i} className="h-6 w-6 overflow-hidden rounded-full border-2 border-surface bg-gradient-to-br from-galli/30 to-galli-violet/30">
                {m.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar} alt="" className="h-full w-full object-cover" />
                )}
              </span>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{counts.members} member{counts.members === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-3">
        <div className="flex gap-2">
          {isPrivileged && editHref && (
            <Link href={editHref} className="inline-flex items-center gap-1.5 rounded-full bg-galli px-4 py-2 text-sm font-semibold text-white"><Pencil className="h-4 w-4" /> Edit</Link>
          )}
          {!isPrivileged && (
            <button onClick={onToggleJoin} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${joined ? 'border border-border text-foreground' : 'bg-galli text-white'}`}>
              {joined ? <><Check className="h-4 w-4" /> Joined</> : <><UserPlus className="h-4 w-4" /> Follow</>}
            </button>
          )}
          <button onClick={share} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium"><Share2 className="h-4 w-4" /> Share</button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {tiles.map(([label, n]) => (
            <div key={label} className="rounded-xl border border-border px-3 py-2 text-center">
              <div className="text-base font-bold">{n}</div>
              <div className="text-[11px] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
