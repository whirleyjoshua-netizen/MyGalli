'use client'

import { Eye, Globe } from 'lucide-react'
import type { ExploreRowItem } from '@/lib/explore'

const GRADIENTS = [
  'from-galli/20 via-galli-aqua/10 to-galli-violet/10',
  'from-galli-aqua/20 via-galli-violet/10 to-galli/10',
  'from-galli-violet/20 via-galli/10 to-galli-aqua/10',
]

export function ExploreRowCard({ item, index, size = 'row' }: { item: ExploreRowItem; index: number; size?: 'row' | 'grid' }) {
  const author = item.user.name || item.user.username
  return (
    <a
      href={`/${item.user.username}/${item.slug}`}
      className={`group relative ${size === 'row' ? 'shrink-0 w-64 snap-start' : 'w-full'} rounded-2xl border border-border bg-surface overflow-hidden shadow-soft hover:shadow-soft-lg hover:border-primary/30 transition-all cursor-pointer`}
    >
      <div className={`relative ${size === 'row' ? 'h-40' : 'h-44'} ${item.coverImage ? '' : `bg-gradient-to-br ${GRADIENTS[index % GRADIENTS.length]}`}`}>
        {item.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        )}
        {item.views > 0 && (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/50 text-white text-xs px-2 py-0.5 backdrop-blur-sm">
            <Eye className="w-3 h-3" /> {item.views.toLocaleString()}
          </span>
        )}
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
        <div className="absolute bottom-2.5 left-3 right-3">
          <h3 className="text-white font-semibold text-sm truncate drop-shadow">{item.title}</h3>
          <p className="flex items-center gap-1 text-white/80 text-xs truncate">
            <Globe className="w-3 h-3" /> by {author}
          </p>
        </div>
      </div>
    </a>
  )
}
