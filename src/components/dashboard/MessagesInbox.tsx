'use client'

import { useEffect, useState } from 'react'
import { Trash2, Mail, MailOpen } from 'lucide-react'

interface Msg {
  id: string; kind: string; body?: string | null; mediaUrl?: string | null
  senderName?: string | null; senderEmail?: string | null; read: boolean
  createdAt: string; display?: { title?: string | null } | null
}

export function MessagesInbox() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/messages', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => { if (!cancelled) setMessages(Array.isArray(d.messages) ? d.messages : []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const markRead = async (m: Msg) => {
    if (m.read) return
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read: true } : x)))
    await fetch(`/api/messages/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) }).catch(() => {})
  }
  const remove = async (id: string) => {
    setMessages((prev) => prev.filter((x) => x.id !== id))
    await fetch(`/api/messages/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (messages.length === 0) return <p className="text-sm text-muted-foreground">No messages yet.</p>

  return (
    <ul className="space-y-2">
      {messages.map((m) => (
        <li key={m.id} onClick={() => markRead(m)}
          className={`rounded-xl border p-4 cursor-pointer ${m.read ? 'border-border bg-background' : 'border-primary/30 bg-primary/5'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm">
                {m.read ? <MailOpen className="w-4 h-4 text-muted-foreground" /> : <Mail className="w-4 h-4 text-primary" />}
                <span className={`font-semibold ${m.read ? 'text-foreground' : 'text-foreground'}`}>{m.senderName || 'Anonymous'}</span>
                <span className="text-xs text-muted-foreground">· {m.display?.title || 'Profile'}</span>
              </div>
              {m.body && <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">{m.body}</p>}
              {m.mediaUrl && <audio src={m.mediaUrl} controls className="mt-2 h-8" />}
              {m.senderEmail && <p className="mt-1 text-xs text-muted-foreground">{m.senderEmail}</p>}
            </div>
            <button onClick={(e) => { e.stopPropagation(); remove(m.id) }} aria-label={`delete-${m.id}`} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
