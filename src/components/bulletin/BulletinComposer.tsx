'use client'

import { useState, useRef } from 'react'
import { ImagePlus, BarChart3, Star, MessageSquareText, X } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { makeBlock, BlockEditor } from './BlockEditor'

export function BulletinComposer({ onPosted }: { onPosted: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [block, setBlock] = useState<CanvasElement | null>(null)
  const [revealAfterAnswer, setReveal] = useState(false)
  const [liveTally, setLive] = useState(true)
  const [isPublic, setIsPublic] = useState(false)
  const [posting, setPosting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setText(''); setImageUrl(null); setBlock(null); setReveal(false); setLive(true); setIsPublic(false); setExpanded(false)
  }

  const uploadImage = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (res.ok) setImageUrl((await res.json()).url)
  }

  const post = async () => {
    if (posting) return
    setPosting(true)
    try {
      const res = await fetch('/api/bulletin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, imageUrl, block, settings: { revealAfterAnswer, liveTally }, isPublic }),
      })
      if (res.ok) {
        reset()
        onPosted()
      }
    } catch {
      /* degrade quietly */
    } finally {
      setPosting(false)
    }
  }

  const canPost = !!(text.trim() || imageUrl || block)

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm text-muted-foreground hover:border-primary/40"
      >
        Share something with your followers…
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3 space-y-2.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's on your mind?"
        rows={2}
        maxLength={2000}
        className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
      />

      {imageUrl && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="w-full rounded-lg" />
          <button onClick={() => setImageUrl(null)} className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {block && <BlockEditor block={block} onChange={setBlock} onRemove={() => setBlock(null)} />}

      {/* Toolbar */}
      <div className="flex items-center gap-1">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
        <ToolBtn label="Image" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" /></ToolBtn>
        {!block && <ToolBtn label="Poll" onClick={() => setBlock(makeBlock('poll'))}><BarChart3 className="h-4 w-4" /></ToolBtn>}
        {!block && <ToolBtn label="Rating" onClick={() => setBlock(makeBlock('rating'))}><Star className="h-4 w-4" /></ToolBtn>}
        {!block && <ToolBtn label="Question" onClick={() => setBlock(makeBlock('shortanswer'))}><MessageSquareText className="h-4 w-4" /></ToolBtn>}
      </div>

      {block && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={revealAfterAnswer} onChange={(e) => setReveal(e.target.checked)} /> Reveal after answering
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={liveTally} onChange={(e) => setLive(e.target.checked)} /> Live tally
          </label>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> 🌍 Share to Trending
        </label>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">Cancel</button>
          <button
            onClick={post}
            disabled={!canPost || posting}
            className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">
      {children}
    </button>
  )
}
