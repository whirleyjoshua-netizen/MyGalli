import Link from 'next/link'
import { Boxes, ArrowRight } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

export function PublicHubElement({ element }: { element: CanvasElement }) {
  const { hubId, hubUsername, hubSlug, hubCoverImage, hubTitleOverride } = element
  const title = hubTitleOverride?.trim() || 'Hub'

  if (!hubId || !hubUsername || !hubSlug) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
        <Boxes className="w-4 h-4" /> Hub not set up yet.
      </div>
    )
  }

  return (
    <Link
      href={`/${hubUsername}/hub/${hubSlug}`}
      className="group relative flex items-center gap-4 p-4 rounded-2xl border border-border bg-surface overflow-hidden hover:border-galli/50 transition"
    >
      {hubCoverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hubCoverImage} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
      ) : (
        <span className="w-16 h-16 rounded-xl bg-gradient-to-br from-galli/30 to-galli-violet/30 flex items-center justify-center shrink-0">
          <Boxes className="w-6 h-6 text-galli-dark" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{title}</p>
        <p className="text-xs text-muted-foreground">Open →</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  )
}
