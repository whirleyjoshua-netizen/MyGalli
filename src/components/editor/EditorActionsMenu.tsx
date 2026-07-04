'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreVertical, Eye, Share2, Users, Check, Save, Globe } from 'lucide-react'

interface EditorActionsMenuProps {
  saving: boolean
  lastSaved: Date | null
  onPreview: () => void
  onShare?: () => void
  onCollaborate?: () => void
  /** When set, a "View Live" link is shown (page is published). */
  liveHref?: string
}

/**
 * Mobile overflow menu for the editor toolbar. On desktop the actions live in
 * the header row directly; on mobile they collapse into this kebab menu. Publish
 * is intentionally excluded — it stays a visible primary button.
 */
export function EditorActionsMenu({
  saving,
  lastSaved,
  onPreview,
  onShare,
  onCollaborate,
  liveHref,
}: EditorActionsMenuProps) {
  const [open, setOpen] = useState(false)

  const run = (fn: () => void) => () => { setOpen(false); fn() }
  const itemClass =
    'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left text-foreground hover:bg-muted transition-colors'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 z-50 w-52 bg-surface border border-border rounded-xl shadow-soft-lg py-1 overflow-hidden"
          >
            {/* Save status (non-interactive) */}
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground border-b border-border">
              {saving ? (
                <><Save className="w-3.5 h-3.5 animate-pulse" /> Saving…</>
              ) : lastSaved ? (
                <><Check className="w-3.5 h-3.5 text-green-500" /> Saved</>
              ) : (
                <span className="opacity-60">Not saved yet</span>
              )}
            </div>

            <button role="menuitem" onClick={run(onPreview)} className={itemClass}>
              <Eye className="w-4 h-4 text-muted-foreground" /> Preview
            </button>

            {onShare && (
              <button role="menuitem" onClick={run(onShare)} className={itemClass}>
                <Share2 className="w-4 h-4 text-muted-foreground" /> Share
              </button>
            )}

            {onCollaborate && (
              <button role="menuitem" onClick={run(onCollaborate)} className={itemClass}>
                <Users className="w-4 h-4 text-muted-foreground" /> Collaborate
              </button>
            )}

            {liveHref && (
              <Link
                role="menuitem"
                href={liveHref}
                target="_blank"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                <Globe className="w-4 h-4 text-muted-foreground" /> View Live
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}
