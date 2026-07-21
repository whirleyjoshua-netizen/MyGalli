'use client'
import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Trash2 } from 'lucide-react'

interface Comment {
  id: string
  author: { id: string; name: string | null; username: string; avatar: string | null }
  text: string
  createdAt: string
}

export function HubPostComments({
  hubId, postId, initialCount, canComment, canModerate, currentUserId,
}: {
  hubId: string
  postId: string
  initialCount: number
  canComment: boolean
  canModerate: boolean
  currentUserId?: string
}) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [count, setCount] = useState(initialCount)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  // Sync only while closed, and only when initialCount has genuinely changed
  // since the last value we adopted. An open thread owns its count (the user
  // may be looking at their own optimistic increment); merely closing the
  // thread must not re-snap the count back to a stale initialCount.
  const lastAdoptedRef = useRef(initialCount)
  useEffect(() => {
    if (!open && initialCount !== lastAdoptedRef.current) {
      lastAdoptedRef.current = initialCount
      setCount(initialCount)
    }
  }, [initialCount, open])

  const base = `/api/hubs/${hubId}/posts/${postId}/comments`

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && comments === null) {
      const res = await fetch(base)
      if (res.ok) setComments((await res.json()).comments)
      else setComments([])
    }
  }
  async function submit() {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      if (res.ok) {
        const { comment } = await res.json()
        setComments((c) => [...(c ?? []), comment])
        setCount((n) => n + 1)
        setText('')
      }
    } finally { setBusy(false) }
  }
  async function remove(cid: string) {
    setComments((c) => (c ?? []).filter((x) => x.id !== cid))
    setCount((n) => Math.max(0, n - 1))
    await fetch(`${base}/${cid}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div className="mt-2 border-t border-border pt-2">
      <button onClick={toggle} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <MessageCircle className="h-3.5 w-3.5" /> {count} comment{count === 1 ? '' : 's'}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {(comments ?? []).map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <span className="font-semibold">{c.author.name || c.author.username}</span>{' '}
                <span className="text-foreground break-words whitespace-pre-wrap">{c.text}</span>
              </div>
              {(canModerate || c.author.id === currentUserId) && (
                <button onClick={() => remove(c.id)} aria-label="delete comment" className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {comments !== null && comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
          {canComment && (
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                placeholder="Write a comment…"
                className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 bg-transparent"
              />
              <button onClick={submit} disabled={busy || !text.trim()} className="text-sm font-semibold text-primary disabled:opacity-40">Post</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
