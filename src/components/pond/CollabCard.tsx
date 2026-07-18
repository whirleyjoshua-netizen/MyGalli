'use client'

import { useRouter } from 'next/navigation'
import { Globe, Lock } from 'lucide-react'
import type { PondCollab } from '@/lib/pond'
import { timeAgo } from '@/lib/time-ago'

export function CollabCard({ collab, view }: { collab: PondCollab; view: 'grid' | 'list' }) {
  const router = useRouter()
  const open = () => router.push(`/editor?id=${collab.id}`)
  const Icon = collab.published ? Globe : Lock

  if (view === 'list') {
    return (
      <button onClick={open} className="w-full text-left flex items-center gap-4 rounded-2xl border border-border bg-surface p-3 shadow-soft hover:shadow-soft-lg hover:border-primary/30 transition-all">
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-galli/20 to-galli-violet/20">
          {collab.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={collab.coverImage} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{collab.title}</h3>
            <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">shared by @{collab.owner.username}</p>
          <p className="text-xs text-muted-foreground mt-1">Updated {timeAgo(collab.updatedAt)} ago</p>
        </div>
      </button>
    )
  }

  return (
    <button onClick={open} className="group text-left flex flex-col rounded-2xl border border-border bg-surface overflow-hidden shadow-soft hover:shadow-soft-lg hover:border-primary/30 transition-all">
      <div className="h-32 bg-gradient-to-br from-galli/20 to-galli-violet/20">
        {collab.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={collab.coverImage} alt="" className="w-full h-full object-cover" />
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold truncate group-hover:text-primary transition-colors">{collab.title}</h3>
          <Icon className="ml-auto w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </div>
        <p className="text-sm text-muted-foreground mt-1 truncate">shared by @{collab.owner.username}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 pt-2 border-t border-border">
          Updated {timeAgo(collab.updatedAt)} ago
        </div>
      </div>
    </button>
  )
}
