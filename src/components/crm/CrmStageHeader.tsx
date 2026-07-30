'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CrmStage } from '@prisma/client'
import { Trash2 } from 'lucide-react'

export function CrmStageHeader({
  stage,
  count,
  neighbourName,
  onRename,
  onRecolor,
  onDelete,
}: {
  stage: CrmStage
  count: number
  /** Name of the stage `deleteStage` will move contacts to (left, or right for the first stage). */
  neighbourName: string
  onRename: (stageId: string, name: string) => void
  onRecolor: (stageId: string, color: string) => void
  onDelete: (stageId: string) => Promise<{ ok: true } | { ok: false; error: string }>
}) {
  const [name, setName] = useState(stage.name)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Portals need a DOM target, which doesn't exist during SSR.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => setName(stage.name), [stage.name])

  const commitRename = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== stage.name) onRename(stage.id, trimmed)
    else setName(stage.name)
  }

  const confirmDelete = async () => {
    setDeleting(true)
    setError(null)
    const result = await onDelete(stage.id)
    setDeleting(false)
    if (result.ok) {
      setConfirmOpen(false)
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="flex items-center gap-2 px-1 pb-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        aria-label="Stage name"
        className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-bold text-foreground hover:border-border focus:border-border focus:bg-background focus:outline-none"
      />
      <input
        type="color"
        value={stage.color}
        onChange={(e) => onRecolor(stage.id, e.target.value)}
        aria-label="Stage color"
        className="h-5 w-5 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
      />
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{count}</span>
      <button
        onClick={() => { setError(null); setConfirmOpen(true) }}
        aria-label={`Delete ${stage.name} stage`}
        className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {confirmOpen && mounted && createPortal(
        // Portalled to <body> on purpose: this header lives inside the
        // dashboard's sticky sidebar subtree, and `position: sticky` creates
        // a stacking context — a `fixed z-50` overlay rendered in place would
        // stay trapped below the main content instead of covering the page.
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !deleting && setConfirmOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold">Delete &ldquo;{stage.name}&rdquo;?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {count > 0
                ? `${count} contact${count === 1 ? '' : 's'} will move to ${neighbourName}.`
                : `This stage has no contacts, so nothing will need to move.`}
            </p>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                aria-busy={deleting}
                className="rounded-full bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete stage'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
