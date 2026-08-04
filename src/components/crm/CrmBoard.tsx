'use client'

import { useEffect, useRef, useState } from 'react'
import type { CrmStage } from '@prisma/client'
import { LayoutGrid, List as ListIcon, Plus, UserPlus } from 'lucide-react'
import { CrmStageHeader } from './CrmStageHeader'
import { CrmContactCard, type CrmContactWithActivity } from './CrmContactCard'
import { CrmList } from './CrmList'
import { CrmContactDrawer } from './CrmContactDrawer'
import { CrmAddContactDialog } from './CrmAddContactDialog'

export function CrmBoard({
  stages: initialStages,
  contacts: initialContacts,
  onSelect,
}: {
  stages: CrmStage[]
  contacts: CrmContactWithActivity[]
  onSelect?: (contact: CrmContactWithActivity) => void
}) {
  const [stages, setStages] = useState(initialStages)
  const [contacts, setContacts] = useState(initialContacts)
  const [error, setError] = useState<string | null>(null)
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)
  const [view, setView] = useState<'board' | 'list'>('board')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [addingStage, setAddingStage] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [addingContact, setAddingContact] = useState(false)

  // restage()'s revert closure needs the stage list as it stands when the
  // PATCH fails, not as it was when the drag started — a stage can be deleted
  // while the request is in flight.
  const stagesRef = useRef(stages)
  useEffect(() => {
    stagesRef.current = stages
  }, [stages])

  const selectContact = (contact: CrmContactWithActivity) => {
    setSelectedContactId(contact.id)
    onSelect?.(contact)
  }

  // Merge the drawer's saved fields into this contact only — never replace
  // the whole contacts array, so an in-flight board drag or list refetch
  // can't be clobbered by a stale drawer response.
  const applyContactUpdate = (updated: Partial<CrmContactWithActivity> & { id: string }) => {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
  }

  const restage = async (contactId: string, stageId: string) => {
    const prevStageId = contacts.find((c) => c.id === contactId)?.stageId
    if (prevStageId === undefined || prevStageId === stageId) return

    setError(null)
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, stageId } : c)))

    const revert = () =>
      setContacts((prev) =>
        prev.map((c) => {
          if (c.id !== contactId) return c
          // If the stage we came from was deleted while this PATCH was in
          // flight, reverting into it would strand the card: the board only
          // renders columns for known stages, so the contact would vanish from
          // the UI entirely while the server had it somewhere valid. Fall back
          // to the first surviving stage instead.
          const restored = stagesRef.current.some((s) => s.id === prevStageId)
            ? prevStageId
            : (stagesRef.current[0]?.id ?? c.stageId)
          return { ...c, stageId: restored }
        })
      )

    try {
      const res = await fetch(`/api/crm/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId }),
      })
      if (!res.ok) {
        revert()
        setError('Could not move that contact. Please try again.')
      }
    } catch {
      revert()
      setError('Could not move that contact. Please try again.')
    }
  }

  // Without this, deleting stages is one-way: an owner who trims the pipeline
  // down to a single column has no way to build it back up, and the
  // manual-contact merge key is unreachable.
  const addStage = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return

    setError(null)
    try {
      const res = await fetch('/api/crm/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not add that stage. Please try again.')
        return
      }
      setStages((prev) => [...prev, data])
      setNewStageName('')
      setAddingStage(false)
    } catch {
      setError('Could not add that stage. Please try again.')
    }
  }

  const addContact = async (name: string, email: string) => {
    setError(null)
    try {
      const res = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not add that contact. Please try again.')
        return false
      }
      // The POST returns a bare row; the board's contact shape expects an
      // activities array, and a manual contact genuinely has none yet.
      setContacts((prev) => [{ ...data, activities: [] }, ...prev])
      setAddingContact(false)
      return true
    } catch {
      setError('Could not add that contact. Please try again.')
      return false
    }
  }

  const renameStage = async (stageId: string, name: string) => {
    const prevName = stages.find((s) => s.id === stageId)?.name
    if (prevName === undefined) return

    setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, name } : s)))

    const revert = () =>
      setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, name: prevName } : s)))

    try {
      const res = await fetch(`/api/crm/stages/${stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}))
        revert()
        setError(data.error || 'You already have a stage with that name.')
        return
      }
      if (!res.ok) {
        revert()
        setError('Could not rename that stage. Please try again.')
      }
    } catch {
      revert()
      setError('Could not rename that stage. Please try again.')
    }
  }

  const recolorStage = async (stageId: string, color: string) => {
    const prevColor = stages.find((s) => s.id === stageId)?.color
    if (prevColor === undefined) return

    setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, color } : s)))

    const revert = () =>
      setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, color: prevColor } : s)))

    try {
      const res = await fetch(`/api/crm/stages/${stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      })
      if (!res.ok) {
        revert()
        setError('Could not recolor that stage. Please try again.')
      }
    } catch {
      revert()
      setError('Could not recolor that stage. Please try again.')
    }
  }

  const deleteStage = async (stageId: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const res = await fetch(`/api/crm/stages/${stageId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) {
        return { ok: false, error: data.error || 'You need at least one stage.' }
      }
      if (!res.ok) {
        return { ok: false, error: 'Could not delete that stage. Please try again.' }
      }
      // Deletion is confirmed by the server response, not optimistic — so the
      // removal + reassignment can be applied directly via functional updaters
      // without needing a whole-array snapshot to revert.
      setStages((prev) => prev.filter((s) => s.id !== stageId))
      setContacts((prev) => prev.map((c) => (c.stageId === stageId ? { ...c, stageId: data.movedTo } : c)))
      return { ok: true }
    } catch {
      return { ok: false, error: 'Could not delete that stage. Please try again.' }
    }
  }

  return (
    <div className="px-4 sm:px-6">
      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={() => setAddingContact(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground shadow-soft transition hover:bg-muted/40"
        >
          <UserPlus className="h-3.5 w-3.5" /> Add contact
        </button>
        <div className="inline-flex rounded-full border border-border bg-muted/30 p-1">
          <button
            onClick={() => setView('board')}
            aria-pressed={view === 'board'}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
              view === 'board' ? 'bg-surface shadow-soft text-foreground' : 'text-muted-foreground'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Board
          </button>
          <button
            onClick={() => setView('list')}
            aria-pressed={view === 'list'}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
              view === 'list' ? 'bg-surface shadow-soft text-foreground' : 'text-muted-foreground'
            }`}
          >
            <ListIcon className="h-3.5 w-3.5" /> List
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <CrmList contacts={contacts} stages={stages} onSelect={selectContact} />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage, index) => {
            const stageContacts = contacts.filter((c) => c.stageId === stage.id)
            // Mirrors deleteStage's neighbour pick: left, or right for the first stage.
            const neighbour = index === 0 ? stages[1] : stages[index - 1]

            return (
              <div
                key={stage.id}
                onDragOver={(e) => { e.preventDefault(); setDragOverStageId(stage.id) }}
                onDragLeave={() => setDragOverStageId((prev) => (prev === stage.id ? null : prev))}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverStageId(null)
                  const contactId = e.dataTransfer.getData('text/plain')
                  if (contactId) restage(contactId, stage.id)
                }}
                className={`w-72 shrink-0 rounded-2xl border p-2 transition ${
                  dragOverStageId === stage.id ? 'border-galli/50 bg-galli/5' : 'border-border bg-muted/30'
                }`}
              >
                <CrmStageHeader
                  stage={stage}
                  count={stageContacts.length}
                  neighbourName={neighbour?.name ?? 'another stage'}
                  onRename={renameStage}
                  onRecolor={recolorStage}
                  onDelete={deleteStage}
                />
                <div className="space-y-2">
                  {stageContacts.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">No contacts yet.</p>
                  ) : (
                    stageContacts.map((contact) => (
                      <CrmContactCard
                        key={contact.id}
                        contact={contact}
                        stages={stages}
                        onRestage={restage}
                        onSelect={selectContact}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}

          <div className="w-72 shrink-0">
            {addingStage ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  addStage(newStageName)
                }}
                className="rounded-2xl border border-dashed border-border p-3"
              >
                <input
                  autoFocus
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  onBlur={() => {
                    if (!newStageName.trim()) setAddingStage(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setNewStageName('')
                      setAddingStage(false)
                    }
                  }}
                  placeholder="Stage name"
                  aria-label="New stage name"
                  maxLength={40}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="submit"
                    className="rounded-full bg-galli px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    disabled={!newStageName.trim()}
                  >
                    Add stage
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewStageName('')
                      setAddingStage(false)
                    }}
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAddingStage(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border px-3 py-6 text-xs font-semibold text-muted-foreground transition hover:border-galli/50 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Add stage
              </button>
            )}
          </div>
        </div>
      )}

      {addingContact && (
        <CrmAddContactDialog onCancel={() => setAddingContact(false)} onCreate={addContact} />
      )}

      {selectedContactId && (
        <CrmContactDrawer
          contactId={selectedContactId}
          stages={stages}
          onClose={() => setSelectedContactId(null)}
          onUpdated={applyContactUpdate}
        />
      )}
    </div>
  )
}
