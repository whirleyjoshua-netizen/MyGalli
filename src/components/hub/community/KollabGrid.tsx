'use client'

import { Play, Trash2, Check, X } from 'lucide-react'
import type { DropDTO } from '@/lib/hub-drops'
import { ReportButton } from '@/components/hub/ReportButton'

function Thumb({ d }: { d: DropDTO }) {
  if (d.thumbnailUrl || d.type === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={d.thumbnailUrl || d.url} alt={d.caption || ''} className="h-full w-full object-cover" />
  }
  return <div className="flex h-full w-full items-center justify-center bg-black/80 text-xs text-white/40">Video</div>
}

export function KollabGrid({
  drops, mode, hubId, currentUserId, isPrivileged, onOpen, onApprove, onReject, onRemove,
}: {
  drops: DropDTO[]
  mode: 'approved' | 'pending'
  hubId: string
  currentUserId?: string
  isPrivileged: boolean
  onOpen: (d: DropDTO) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRemove: (id: string) => void
}) {
  if (drops.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        {mode === 'pending' ? 'Nothing waiting for review.' : 'Nothing in the pool yet.'}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {drops.map((d) => (
        <div key={d.id}>
          <div className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
            <button onClick={() => onOpen(d)} className="block h-full w-full">
              <Thumb d={d} />
              {d.type === 'video' && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Play className="h-8 w-8 text-white drop-shadow" fill="currentColor" />
                </span>
              )}
            </button>
            {mode === 'approved' && (
              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                <ReportButton
                  hubId={hubId}
                  targetType="drop"
                  targetId={d.id}
                  authorId={d.author.userId}
                  currentUserId={currentUserId}
                  className="rounded-md bg-black/60 p-1 text-white hover:bg-black/80"
                />
                {(isPrivileged || d.author.userId === currentUserId) && (
                  <button onClick={() => onRemove(d.id)} title="Remove" className="rounded-md bg-black/60 p-1 text-white hover:bg-black/80">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {mode === 'pending' && (
            <div className="mt-1.5">
              <p className="truncate text-xs text-muted-foreground">
                {d.author.name || d.author.username}
              </p>
              <div className="mt-1 flex gap-1">
                <button
                  onClick={() => onApprove(d.id)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-[#FF6B3D] px-2 py-1 text-xs font-medium text-white hover:opacity-90"
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  onClick={() => onReject(d.id)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
