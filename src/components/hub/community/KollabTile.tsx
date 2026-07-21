'use client'

import { ImagePlus, Loader2 } from 'lucide-react'
import { KollabWordmark } from './KollabWordmark'

export function KollabTile({
  count, pendingCount, canDrop, isPrivileged, uploading, onDrop, onSee,
}: {
  count: number
  pendingCount: number
  canDrop: boolean
  isPrivileged: boolean
  uploading: boolean
  onDrop: () => void
  onSee: () => void
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 text-center">
      <KollabWordmark className="mx-auto h-10 w-auto" />
      <p className="mt-2 text-sm text-muted-foreground">
        {count === 0
          ? 'Be the first to drop something.'
          : count === 1
            ? '1 clip or photo'
            : `${count} clips & photos`}
      </p>

      <div className="mt-4 space-y-2">
        {canDrop && (
          <button
            onClick={onDrop}
            disabled={uploading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF6B3D] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Drop content'}
          </button>
        )}
        <button
          onClick={onSee}
          disabled={count === 0 && !(isPrivileged && pendingCount > 0)}
          className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          See content
        </button>
      </div>

      {isPrivileged && pendingCount > 0 && (
        <p className="mt-3 text-xs font-medium text-amber-600">{pendingCount} awaiting review</p>
      )}
    </section>
  )
}
