'use client'

import { useState } from 'react'
import { Share2, ChevronDown } from 'lucide-react'
import { SocialShareButtons } from './SocialShareButtons'

// Quiet, visitor-facing share affordance rendered at the bottom of a published
// page. Distinct from the editor's SocialShareButtons usages (PublishDialog /
// ShareDialog) which never pass a displayId — this one does, so visitor shares
// (not the owner's own) are what feed the "Shares" analytics metric.
export function PublicShareBar({
  url,
  title,
  displayId,
}: {
  url: string
  title: string
  displayId: string
}) {
  const [open, setOpen] = useState(false)

  if (!url) return null

  return (
    <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-border bg-surface p-4 shadow-soft">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-galli" />
          Share this page
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3">
          <SocialShareButtons url={url} title={title} displayId={displayId} />
        </div>
      )}
    </div>
  )
}
