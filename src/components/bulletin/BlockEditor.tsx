'use client'

import { X } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { BulletinBlockType } from '@/lib/bulletin'

export function makeBlock(type: BulletinBlockType): CanvasElement {
  const id = `blk-${type}-${String(Math.abs(hashStr(type + '-seed')))}`
  if (type === 'poll') return { id, type, pollQuestion: '', pollOptions: ['', ''] }
  if (type === 'rating') return { id, type, ratingQuestion: '', ratingMax: 5, ratingStyle: 'stars' }
  return { id, type, shortAnswerQuestion: '', shortAnswerPlaceholder: 'Type your answer…' }
}

// Deterministic id seed (no Math.random so ids are stable per render tree).
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

export function BlockEditor({ block, onChange, onRemove }: { block: CanvasElement; onChange: (b: CanvasElement) => void; onRemove: () => void }) {
  const set = (patch: Partial<CanvasElement>) => onChange({ ...block, ...patch })
  return (
    <div className="rounded-lg border border-border bg-background p-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{block.type}</span>
        <button onClick={onRemove} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      {block.type === 'poll' && (
        <>
          <input value={block.pollQuestion || ''} onChange={(e) => set({ pollQuestion: e.target.value })} placeholder="Poll question" className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary/50" />
          {(block.pollOptions || []).map((opt, i) => (
            <input
              key={i}
              value={opt}
              onChange={(e) => {
                const opts = [...(block.pollOptions || [])]
                opts[i] = e.target.value
                set({ pollOptions: opts })
              }}
              placeholder={`Option ${i + 1}`}
              className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary/50"
            />
          ))}
          <button onClick={() => set({ pollOptions: [...(block.pollOptions || []), ''] })} className="text-xs text-primary hover:underline">+ Add option</button>
        </>
      )}
      {block.type === 'rating' && (
        <input value={block.ratingQuestion || ''} onChange={(e) => set({ ratingQuestion: e.target.value })} placeholder="Rating question" className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary/50" />
      )}
      {block.type === 'shortanswer' && (
        <input value={block.shortAnswerQuestion || ''} onChange={(e) => set({ shortAnswerQuestion: e.target.value })} placeholder="Your question" className="w-full rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary/50" />
      )}
    </div>
  )
}
