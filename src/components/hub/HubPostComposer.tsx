'use client'
import { useState } from 'react'

export function HubPostComposer({ hubId, onPosted }: { hubId: string; onPosted: () => void }) {
  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!text.trim() && !imageUrl) return
    setBusy(true)
    try {
      const res = await fetch(`/api/hubs/${hubId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, imageUrl }),
      })
      if (res.ok) { setText(''); setImageUrl(''); onPosted() }
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
      <div className="mt-2 flex items-center justify-end">
        <button
          onClick={submit}
          disabled={busy || (!text.trim() && !imageUrl)}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
        >
          Post
        </button>
      </div>
    </div>
  )
}
