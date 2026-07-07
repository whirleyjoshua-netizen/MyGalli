'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Trash2, UserPlus } from 'lucide-react'

interface Collaborator {
  userId: string
  user: { username: string; name: string | null; avatar: string | null }
}

interface HubCollaboratorsModalProps {
  hubId: string
  onClose: () => void
}

export function HubCollaboratorsModal({ hubId, onClose }: HubCollaboratorsModalProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/hubs/${hubId}/collaborators`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setCollaborators(data.collaborators)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [hubId])

  const invite = async () => {
    const name = username.trim()
    if (!name) return
    setInviting(true)
    setError(null)
    try {
      const res = await fetch(`/api/hubs/${hubId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not add collaborator')
        return
      }
      // Re-fetch to pick up the new collaborator's profile.
      const r = await fetch(`/api/hubs/${hubId}/collaborators`)
      if (r.ok) setCollaborators((await r.json()).collaborators)
      setUsername('')
    } catch {
      setError('Something went wrong')
    } finally {
      setInviting(false)
    }
  }

  const remove = async (userId: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/hubs/${hubId}/collaborators`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) setCollaborators((prev) => prev.filter((c) => c.userId !== userId))
      else setError('Could not remove collaborator')
    } catch {
      setError('Could not remove collaborator')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-soft-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="text-lg font-bold">Collaborators</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Collaborators can view all private content in this Hub without a passcode.
          </p>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && invite()}
              placeholder="Invite by username"
              className="flex-1 min-w-0 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={invite}
              disabled={inviting || !username.trim()}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Add
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

          <div className="mt-4 space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : collaborators.length === 0 ? (
              <p className="text-sm text-muted-foreground">No collaborators yet.</p>
            ) : (
              collaborators.map((c) => (
                <div
                  key={c.userId}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.user.username)}`}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.user.name || c.user.username}</p>
                    <p className="text-xs text-muted-foreground truncate">@{c.user.username}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(c.userId)}
                    aria-label={`Remove ${c.user.username}`}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
