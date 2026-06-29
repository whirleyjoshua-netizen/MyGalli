'use client'

import { Globe, MoreHorizontal } from 'lucide-react'

export interface FeedItem {
  id: string
  slug: string
  title: string
  coverImage?: string | null
  user: { username: string; name?: string | null; avatar?: string | null }
}

const GRADIENTS = [
  'from-galli/20 via-galli-aqua/10 to-galli-violet/10',
  'from-galli-aqua/20 via-galli-violet/10 to-galli/10',
  'from-galli-violet/20 via-galli/10 to-galli-aqua/10',
]

export function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  const author = item.user?.name || item.user?.username || 'Someone'
  return (
    <a
      href={`/${item.user?.username}/${item.slug}`}
      target="_blank"
      rel="noreferrer"
      className="group shrink-0 w-60 snap-start rounded-2xl border border-border bg-surface overflow-hidden shadow-soft hover:shadow-soft-lg hover:border-primary/30 transition-all cursor-pointer"
    >
      {/* Full-bleed cover — info overlaid, no white strip */}
      <div className={`h-52 relative ${item.coverImage ? '' : `bg-gradient-to-br ${GRADIENTS[index % GRADIENTS.length]}`}`}>
        {item.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-black/75 via-black/35 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 p-3">
          <h3 className="text-white font-semibold text-sm truncate drop-shadow">
            {item.title}
          </h3>
          <div className="mt-1.5 flex items-center justify-between text-white/90">
            <span className="flex items-center gap-1.5 text-xs min-w-0 drop-shadow">
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">by {author}</span>
            </span>
            <MoreHorizontal className="w-4 h-4 text-white/70 shrink-0" />
          </div>
        </div>
      </div>
    </a>
  )
}
