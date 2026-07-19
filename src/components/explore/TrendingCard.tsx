'use client'

import Link from 'next/link'
import { Eye, Users, FileText, LayoutGrid } from 'lucide-react'
import type { TrendingItem } from '@/lib/explore'

export function TrendingCard({ item }: { item: TrendingItem }) {
  const isBoard = item.kind === 'collection'
  return (
    <Link
      href={`/${item.user.username}/${item.slug}`}
      className="group w-64 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition hover:border-galli/40 hover:shadow-soft-lg"
    >
      {/* Full-bleed cover — info is overlaid, no white strip */}
      <div className={`relative h-52 w-full overflow-hidden ${item.coverImage ? '' : 'bg-gradient-to-br from-galli/20 to-galli-aqua/15'}`}>
        {item.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        )}

        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          {isBoard ? <LayoutGrid className="h-3 w-3" /> : <FileText className="h-3 w-3" />} {isBoard ? 'Board' : 'Page'}
        </span>

        {/* scrim for legibility of overlaid info */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />

        {/* Overlaid info (was the white strip) */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="truncate font-bold text-white drop-shadow">{item.title}</p>
          <p className="truncate text-xs text-white/80 drop-shadow">by @{item.user.username}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-white/90 drop-shadow">
            <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {item.views}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {item.followerCount}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
