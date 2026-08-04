// Pure helpers for turning messy visitor input into a stable merge key.
// No database access — this file must stay trivially testable.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// RFC 5321's ceiling. Without it a visitor can post a multi-kilobyte "address"
// that becomes a mergeKey — and past ~2704 bytes the btree index on
// (ownerId, mergeKey) refuses the insert, so the lead vanishes into ingest's
// catch instead of being rejected here. Not every producer validates length
// upstream; the comments seam does not.
const MAX_EMAIL_LENGTH = 254

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().toLowerCase()
  if (v.length > MAX_EMAIL_LENGTH) return null
  return EMAIL_RE.test(v) ? v : null
}

type Answer = { type?: unknown; question?: unknown; answer?: unknown }

function entries(responses: unknown): Answer[] {
  if (!responses || typeof responses !== 'object' || Array.isArray(responses)) return []
  return Object.values(responses as Record<string, unknown>).filter(
    (v): v is Answer => !!v && typeof v === 'object' && !Array.isArray(v)
  )
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

// Ranked: a field declared as an email beats one merely named like an email,
// which beats a value that happens to look like one. Without the ranking a
// "referred by" field can hijack the merge key and fuse two people together.
export function sniffFormContact(responses: unknown): { email: string | null; name: string | null } {
  const all = entries(responses)

  // Fields the form itself declares as an email — by input type, or by asking
  // for one in the question text.
  const declared = all.filter(
    (e) => str(e.type).toLowerCase().includes('email') || /e-?mail/i.test(str(e.question))
  )

  // Fall through to "any answer shaped like an email" ONLY when the form asked
  // for no email at all. Falling through whenever the declared field failed to
  // parse is what lets a blank "Your email" plus a filled "Who referred you?"
  // hand the merge key to the referrer — the submitter's answers would then be
  // filed onto someone else's contact.
  const email = declared.length
    ? (declared.map((e) => normalizeEmail(e.answer)).find((v) => v !== null) ?? null)
    : (all.map((e) => normalizeEmail(e.answer)).find((v) => v !== null) ?? null)

  const nameEntry = all.find(
    (e) => /\bname\b/i.test(str(e.question)) && !/e-?mail/i.test(str(e.question))
  )
  const name = str(nameEntry?.answer).trim().slice(0, 120) || null

  return { email, name }
}
