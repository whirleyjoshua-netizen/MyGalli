'use client'
import { useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'
import { makeBlock, BlockEditor } from '@/components/bulletin/BlockEditor'
import { BarChart3, Star, MessageSquareText } from 'lucide-react'

export function HubPostComposer({ hubId, onPosted }: { hubId: string; onPosted: () => void }) {
  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [block, setBlock] = useState<CanvasElement | null>(null)
  const [revealAfterAnswer, setReveal] = useState(false)
  const [liveTally, setLive] = useState(true)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!text.trim() && !imageUrl && !block) return
    setBusy(true)
    try {
      const res = await fetch(`/api/hubs/${hubId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, imageUrl, block, settings: { revealAfterAnswer, liveTally } }),
      })
      if (res.ok) { setText(''); setImageUrl(''); setBlock(null); onPosted() }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Post an update to your community…"
        className="w-full resize-none bg-transparent text-sm outline-none"
        rows={3}
      />
      {block && <BlockEditor block={block} onChange={setBlock} onRemove={() => setBlock(null)} />}
      {!block && (
        <div className="flex items-center gap-1">
          <button type="button" title="Poll" onClick={() => setBlock(makeBlock('poll'))}><BarChart3 className="h-4 w-4" /></button>
          <button type="button" title="Rating" onClick={() => setBlock(makeBlock('rating'))}><Star className="h-4 w-4" /></button>
          <button type="button" title="Question" onClick={() => setBlock(makeBlock('shortanswer'))}><MessageSquareText className="h-4 w-4" /></button>
        </div>
      )}
      <div className="mt-2 flex items-center justify-end">
        <button
          onClick={submit}
          disabled={busy || (!text.trim() && !imageUrl && !block)}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
        >
          Post
        </button>
      </div>
    </div>
  )
}
