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

// Places a brand-new contact in the owner's leftmost stage.
//
// The stage list is read and then written to in two statements, and the
// leftmost stage is exactly the one an owner is most likely to be renaming or
// deleting. If it disappears between the two, the create hits the Restrict FK
// with P2003 — which the caller's blanket catch would turn into a silently
// dropped lead, after the visitor already got a 200. So retry once against a
// freshly resolved stage list; ensureStages reseeds the defaults if the owner
// managed to end up with none.
async function createContact(ownerId: string, email: string, name: string | null) {
  for (let attempt = 0; ; attempt++) {
    const stages = await ensureStages(ownerId)
    try {
      return await db.crmContact.create({
        data: { ownerId, stageId: stages[0].id, mergeKey: email, email, name },
      })
    } catch (error) {
      const code = (error as { code?: string })?.code
      if (code !== 'P2003' || attempt >= 1) throw error
    }
  }
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
      select: { userId: true, published: true },
    })
    if (!display) return

    // Only live pages feed the CRM. The forms, waitlist and lead-gen routes
    // check this themselves, but the comments route does not — so knowing a
    // draft display's id was enough to plant a contact in a stranger's
    // pipeline. Checking here covers every seam at once.
    if (!display.published) return

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
      // later form submit must not clobber that. Bump updatedAt regardless,
      // since sorting relies on it tracking the latest activity, not the
      // latest row edit.
      await db.crmContact.update({
        where: { id: contact.id },
        data: { updatedAt: new Date(), ...(!contact.name && name ? { name } : {}) },
      })
    } else {
      contact = await createContact(ownerId, email, name)
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
