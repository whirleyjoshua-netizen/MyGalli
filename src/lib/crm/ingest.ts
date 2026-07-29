import { db } from '@/lib/db'
import { normalizeEmail } from './email'
import { ensureStages } from './stages'

export type LeadSource = 'form' | 'booking' | 'waitlist' | 'lead-capture' | 'comment' | 'note'

export interface IngestLeadInput {
  displayId: string
  email: unknown
  name?: string | null
  source: LeadSource
  sourceId?: string | null
  summary: string
  payload?: Record<string, unknown>
  occurredAt?: Date
}

// Records a lead against the page owner's CRM.
//
// This runs for every user regardless of plan, and it must NEVER throw: it is
// called after a visitor's booking or form submit has already committed, and a
// CRM problem is not a reason to fail their action. Every failure path here is
// a log, not an exception.
export async function ingestLead(input: IngestLeadInput): Promise<void> {
  try {
    const email = normalizeEmail(input.email)
    // No email means no merge key, which means no way to unify this person with
    // any later touch. An untethered row is noise, so we drop it.
    if (!email) return

    const display = await db.display.findUnique({
      where: { id: input.displayId },
      select: { userId: true },
    })
    if (!display) return

    const ownerId = display.userId

    if (input.sourceId) {
      const seen = await db.crmActivity.findUnique({
        where: { source_sourceId: { source: input.source, sourceId: input.sourceId } },
      })
      if (seen) return
    }

    const name = input.name?.trim().slice(0, 120) || null

    let contact = await db.crmContact.findUnique({
      where: { ownerId_mergeKey: { ownerId, mergeKey: email } },
    })

    if (contact) {
      // Backfill only. The owner may have corrected the name by hand, and a
      // later form submit must not clobber that.
      if (!contact.name && name) {
        await db.crmContact.update({ where: { id: contact.id }, data: { name } })
      }
    } else {
      const stages = await ensureStages(ownerId)
      contact = await db.crmContact.create({
        data: { ownerId, stageId: stages[0].id, mergeKey: email, email, name },
      })
    }

    await db.crmActivity.create({
      data: {
        contactId: contact.id,
        source: input.source,
        sourceId: input.sourceId ?? null,
        displayId: input.displayId,
        summary: input.summary.slice(0, 280),
        payload: (input.payload ?? {}) as object,
        occurredAt: input.occurredAt ?? new Date(),
      },
    })
  } catch (error) {
    console.error('CRM ingest failed:', error)
  }
}
