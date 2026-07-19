'use client'

import Link from 'next/link'
import { Eye, Users, FileText, LayoutGrid } from 'lucide-react'
import type { TrendingItem } from '@/lib/explore'

export function TrendingCard({ item }: { item: TrendingItem }) {
  const isBoard = item.kind === 'collection'
  return (
    <Link
      href={`/${item.user.username}/${item.slug}`}
      className="w-64 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition hover:border-galli/40"
    >
      <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-galli/20 to-galli-aqua/15">
        {item.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.coverImage} alt="" className="h-full w-full object-cover" />
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground">
          {isBoard ? <LayoutGrid className="h-3 w-3" /> : <FileText className="h-3 w-3" />} {isBoard ? 'Board' : 'Page'}
        </span>
      </div>
      <div className="p-3">
        <p className="truncate font-bold">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">by @{item.user.username}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {item.views}</span>
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {item.followerCount}</span>
        </div>
      </div>
    </Link>
  )
}
