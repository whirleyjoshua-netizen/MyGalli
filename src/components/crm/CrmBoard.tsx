'use client'

import { useState } from 'react'
import type { CrmStage } from '@prisma/client'
import { LayoutGrid, List as ListIcon } from 'lucide-react'
import { CrmStageHeader } from './CrmStageHeader'
import { CrmContactCard, type CrmContactWithActivity } from './CrmContactCard'
import { CrmList } from './CrmList'
import { CrmContactDrawer } from './CrmContactDrawer'

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
      setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, stageId: prevStageId } : c)))

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

      <div className="mb-4 flex justify-end">
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
        </div>
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
