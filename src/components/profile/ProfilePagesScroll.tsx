'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Pin, PinOff } from 'lucide-react'

export interface ProfilePage {
  id: string
  slug: string
  title: string
  coverImage?: string | null
  views: number
}

const GRADIENTS = [
  'from-galli/20 via-galli-aqua/10 to-galli-violet/10',
  'from-galli-aqua/20 via-galli-violet/10 to-galli/10',
  'from-galli-violet/20 via-galli/10 to-galli-aqua/10',
]

export function ProfilePagesScroll({
  username,
  pages,
  featuredId,
  isOwner,
}: {
  username: string
  pages: ProfilePage[]
  featuredId?: string | null
  isOwner: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const ordered = useMemo(() => {
    if (!featuredId) return pages
    const featured = pages.filter((p) => p.id === featuredId)
    const rest = pages.filter((p) => p.id !== featuredId)
    return [...featured, ...rest]
  }, [pages, featuredId])

  const togglePin = async (id: string, isFeatured: boolean) => {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featuredDisplayId: isFeatured ? null : id }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (pages.length === 0) {
    return (
      <div className="flex-1 min-w-0 flex items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground py-10">
        No published pages yet.
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="flex gap-4 overflow-x-auto scrollbar-hide snap-x pb-1">
        {ordered.map((p, i) => {
          const isFeatured = p.id === featuredId
          return (
            <div
              key={p.id}
              className="group relative shrink-0 w-60 snap-start rounded-2xl border border-border bg-surface overflow-hidden shadow-soft hover:shadow-soft-lg hover:border-primary/30 transition-all"
            >
              <a href={`/${username}/${p.slug}`} className="block cursor-pointer">
                <div className={`h-36 relative ${p.coverImage ? '' : `bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]}`}`}>
                  {p.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  {isFeatured && (
                    <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-surface/85 backdrop-blur-sm px-2 py-0.5 text-[11px] font-semibold text-galli-dark">
                      <Pin className="w-3 h-3 text-primary" /> Featured
                    </span>
                  )}
                  <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/35 to-transparent" />
                  <h3 className="absolute bottom-2.5 left-3 right-3 text-white font-semibold text-sm truncate drop-shadow">{p.title}</h3>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2.5 text-xs text-muted-foreground">
                  <Eye className="w-3.5 h-3.5" /> {p.views}
                </div>
              </a>
              {isOwner && (
                <button
                  onClick={() => togglePin(p.id, isFeatured)}
                  disabled={busy}
                  aria-label={isFeatured ? 'Unpin from profile' : 'Pin to profile'}
                  title={isFeatured ? 'Unpin from profile' : 'Pin to profile'}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-surface/85 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isFeatured ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
