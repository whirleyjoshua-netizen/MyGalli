'use client'

import { useState } from 'react'
import type { CrmStage } from '@prisma/client'
import { CrmStageHeader } from './CrmStageHeader'
import { CrmContactCard, type CrmContactWithActivity } from './CrmContactCard'

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

  const restage = async (contactId: string, stageId: string) => {
    const previous = contacts
    const current = contacts.find((c) => c.id === contactId)
    if (!current || current.stageId === stageId) return

    setError(null)
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, stageId } : c)))

    try {
      const res = await fetch(`/api/crm/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId }),
      })
      if (!res.ok) {
        setContacts(previous)
        setError('Could not move that contact. Please try again.')
      }
    } catch {
      setContacts(previous)
      setError('Could not move that contact. Please try again.')
    }
  }

  const renameStage = async (stageId: string, name: string) => {
    const previous = stages
    setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, name } : s)))
    try {
      const res = await fetch(`/api/crm/stages/${stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        setStages(previous)
        setError('Could not rename that stage. Please try again.')
      }
    } catch {
      setStages(previous)
      setError('Could not rename that stage. Please try again.')
    }
  }

  const recolorStage = async (stageId: string, color: string) => {
    const previous = stages
    setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, color } : s)))
    try {
      const res = await fetch(`/api/crm/stages/${stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      })
      if (!res.ok) {
        setStages(previous)
        setError('Could not recolor that stage. Please try again.')
      }
    } catch {
      setStages(previous)
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
                      onSelect={onSelect}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
