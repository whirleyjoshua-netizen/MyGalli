// Pure helpers for turning messy visitor input into a stable merge key.
// No database access — this file must stay trivially testable.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().toLowerCase()
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

  const byType = all.find((e) => str(e.type).toLowerCase().includes('email'))
  const byQuestion = all.find((e) => /e-?mail/i.test(str(e.question)))
  const byShape = all.find((e) => normalizeEmail(e.answer) !== null)

  const email = normalizeEmail((byType ?? byQuestion ?? byShape)?.answer) ?? null

  const nameEntry = all.find(
    (e) => /\bname\b/i.test(str(e.question)) && !/e-?mail/i.test(str(e.question))
  )
  const name = str(nameEntry?.answer).trim().slice(0, 120) || null

  return { email, name }
}
