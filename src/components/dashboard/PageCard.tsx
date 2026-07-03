'use client'

import { useRouter } from 'next/navigation'
import { Globe, Lock, Eye, MoreHorizontal, Pin, PinOff, ImageIcon, Trash2, ExternalLink, Pencil, X, BarChart3 } from 'lucide-react'

export interface DashDisplay {
  id: string
  title: string
  slug: string
  published: boolean
  views: number
  updatedAt: string
  coverImage?: string | null
  _count: { elements: number }
}

export function PageCard({
  display,
  gradient,
  selected,
  isPinned,
  isMenuOpen,
  username,
  timeAgo,
  onOpen,
  onSelectPanel,
  onOpenMenu,
  onCloseMenu,
  onTogglePin,
  onDelete,
  onCoverChange,
}: {
  display: DashDisplay
  gradient: string
  selected: boolean
  isPinned: boolean
  isMenuOpen: boolean
  username?: string
  timeAgo: (s: string) => string
  onOpen: (id: string) => void
  onSelectPanel?: (id: string) => void
  onOpenMenu: (id: string) => void
  onCloseMenu: () => void
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
  onCoverChange: (id: string, file: File | null) => void
}) {
  const router = useRouter()
  return (
    <div
      onClick={() => onOpen(display.id)}
      className={`group relative shrink-0 w-60 snap-start rounded-2xl border bg-surface overflow-hidden shadow-soft hover:shadow-soft-lg transition-all cursor-pointer ${
        selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/30'
      }`}
    >
      {/* Full-bleed cover — info is overlaid, no white strip */}
      <div className={`h-52 relative ${display.coverImage ? '' : `bg-gradient-to-br ${gradient}`}`}>
        {display.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={display.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {isPinned && (
          <span className="absolute top-2.5 left-2.5 p-1 rounded-lg bg-surface/80 backdrop-blur-sm">
            <Pin className="w-3.5 h-3.5 text-primary rotate-[-30deg]" />
          </span>
        )}
        <span
          className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[11px] font-medium backdrop-blur-sm ${
            display.published
              ? 'bg-primary/30 text-white border border-white/30'
              : 'bg-black/40 text-white border border-white/20'
          }`}
        >
          {display.published ? 'Public' : 'Draft'}
        </span>

        {/* scrim for legibility of overlaid info */}
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-black/75 via-black/35 to-transparent pointer-events-none" />

        {/* Overlaid info (was the white strip) */}
        <div className="absolute bottom-0 inset-x-0 p-3">
          <h3 className="text-white font-semibold text-sm truncate drop-shadow">
            {display.title}
          </h3>
          <div className="mt-1.5 flex items-center justify-between text-white/90">
            <span className="flex items-center gap-1.5 text-xs drop-shadow">
              {display.published ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {display.published ? 'Public' : 'Private'}
            </span>
            <span className="flex items-center gap-3 text-xs drop-shadow">
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {display.views}
              </span>
              {onSelectPanel && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectPanel(display.id) }}
                  aria-label="Show audience at a glance"
                  title="Show in Audience at a glance"
                  className={`p-0.5 rounded transition-colors cursor-pointer ${
                    selected ? 'text-primary bg-white/20' : 'text-white/90 hover:text-white hover:bg-white/20'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onOpenMenu(display.id) }}
                aria-label="Page options"
                className="p-0.5 rounded hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </span>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onCloseMenu() }} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-3 bottom-12 z-50 w-44 bg-surface border border-border rounded-xl shadow-soft-lg py-1 overflow-hidden"
          >
            <button onClick={() => { router.push(`/editor?id=${display.id}`) }} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors cursor-pointer">
              <Pencil className="w-4 h-4" /> Open in editor
            </button>
            <button onClick={() => { onTogglePin(display.id); onCloseMenu() }} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors cursor-pointer">
              {isPinned ? <><PinOff className="w-4 h-4" /> Unpin</> : <><Pin className="w-4 h-4" /> Pin to top</>}
            </button>
            {display.published && (
              <button onClick={() => { window.open(`/${username}/${display.slug}`, '_blank'); onCloseMenu() }} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors cursor-pointer">
                <ExternalLink className="w-4 h-4" /> View live
              </button>
            )}
            <label className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors cursor-pointer">
              <ImageIcon className="w-4 h-4" /> {display.coverImage ? 'Change cover' : 'Add cover'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { onCoverChange(display.id, f); onCloseMenu() } e.target.value = '' }} />
            </label>
            {display.coverImage && (
              <button onClick={() => { onCoverChange(display.id, null); onCloseMenu() }} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors cursor-pointer">
                <X className="w-4 h-4" /> Remove cover
              </button>
            )}
            <div className="border-t border-border">
              <button onClick={() => { onDelete(display.id); onCloseMenu() }} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 w-full transition-colors cursor-pointer">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
