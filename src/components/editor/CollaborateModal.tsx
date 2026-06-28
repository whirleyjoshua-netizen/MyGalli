'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, UserPlus, Trash2, LogOut, Users } from 'lucide-react'
import { useAuthStore } from '@/lib/store'

interface Collaborator {
  userId: string
  username: string
  name: string | null
  avatar: string | null
  role: string
}

interface CollaborateModalProps {
  isOpen: boolean
  onClose: () => void
  displayId: string
  isOwner: boolean
}

export function CollaborateModal({ isOpen, onClose, displayId, isOwner }: CollaborateModalProps) {
  const { user } = useAuthStore()
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const fetchCollaborators = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/displays/${displayId}/collaborators`)
      if (res.ok) {
        const data = await res.json()
        setCollaborators(data.collaborators || [])
      }
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }, [displayId])

  useEffect(() => {
    if (isOpen) fetchCollaborators()
  }, [isOpen, fetchCollaborators])

  if (!isOpen) return null

  const invite = async () => {
    const name = username.trim().toLowerCase()
    if (!name || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/displays/${displayId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not add collaborator')
        return
      }
      setUsername('')
      await fetchCollaborators()
    } catch {
      setError('Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (userId: string) => {
    try {
      const res = await fetch(`/api/displays/${displayId}/collaborators/${userId}`, { method: 'DELETE' })
      if (res.ok) {
        if (userId === user?.id) {
          onClose()
          return
        }
        await fetchCollaborators()
      }
    } catch {
      /* noop */
    }
  }

  const initialOf = (c: Collaborator) => (c.name || c.username).charAt(0).toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-soft-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="flex items-center gap-2 font-bold text-foreground">
            <Users className="w-4 h-4 text-primary" /> Collaborators
          </h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Invite (owner only) */}
          {isOwner && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Invite by username</label>
              <div className="flex gap-2">
                <input
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); if (error) setError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter') invite() }}
                  placeholder="username"
                  className="flex-1 px-3 py-2 border border-border rounded-xl bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition"
                />
                <button onClick={invite} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-soft hover:brightness-105 transition-all disabled:opacity-50 cursor-pointer">
                  <UserPlus className="w-4 h-4" /> Add
                </button>
              </div>
              {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
              <p className="mt-1.5 text-xs text-muted-foreground">You can invite people you follow or who follow you.</p>
            </div>
          )}

          {/* Roster */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {collaborators.length} collaborator{collaborators.length !== 1 ? 's' : ''}
            </p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : collaborators.length === 0 ? (
              <p className="text-sm text-muted-foreground">No collaborators yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {collaborators.map((c) => (
                  <li key={c.userId} className="flex items-center gap-2.5 p-2 rounded-xl border border-border">
                    {c.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatar} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <span className="w-8 h-8 rounded-lg bg-primary/15 text-primary font-bold text-sm flex items-center justify-center">{initialOf(c)}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name || c.username}</p>
                      <p className="text-xs text-muted-foreground truncate">@{c.username}</p>
                    </div>
                    {(isOwner || c.userId === user?.id) && (
                      <button onClick={() => remove(c.userId)} aria-label="Remove collaborator" className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer">
                        {c.userId === user?.id ? <LogOut className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-accent transition-colors cursor-pointer">Done</button>
        </div>
      </div>
    </div>
  )
}
