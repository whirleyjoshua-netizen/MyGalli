// Pure, DB-free helpers shared by the Interactions detail route and the drawer.
// The route normalises every response store (FormResponse, Message, Booking,
// WaitlistSignup, JerseySignature, Comment) into DetailResponse so the client
// stays one renderer instead of six.

export interface DetailResponse {
  /** Store row id. Present only where a per-row action exists (comment moderation). */
  id?: string
  /** Primary content. May be a string, number, array or an object of named fields. */
  answer: unknown
  submittedAt: string | null
  /** Prefix for the timestamp when it is not "when this arrived", e.g. 'Booked for'. */
  dateLabel?: string
  /** Secondary attribution line — the responder's name. */
  who?: string
  /** Extra badge text, e.g. 'Unread'. */
  meta?: string
  /** Comments only: moderation state, drives the Approve control. */
  approved?: boolean
}

export interface DetailPayload {
  element: { elementId: string; type: string; title: string }
  responses: DetailResponse[]
  series: { date: string; count: number }[]
  responseCount: number
  responsesTruncated: boolean
  /** How far back the response list and series reach. Absent for bulletin. */
  windowDays?: number
  /** An honest explanation when the list is empty for a structural reason. */
  notice?: string
}

export type AnswerLine = { label?: string; value: string }

// Field labels for the object-valued answers stored by PublicRSVPElement,
// PublicWeddingRsvpElement and PublicBusinessReviewElement (plus the booking
// fields the detail route composes). Anything unlisted is humanised generically.
const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  email: 'Email',
  attending: 'Attending',
  guests: 'Guests',
  items: 'Bringing',
  note: 'Note',
  meal: 'Meal',
  plusOneName: 'Plus one',
  dietary: 'Dietary',
  songRequest: 'Song request',
  rating: 'Rating',
  text: 'Review',
}

export function fieldLabel(key: string): string {
  const override = FIELD_LABELS[key]
  if (override) return override
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

// Renders any JSON value to text. Objects are expanded to "Label: value" pairs
// rather than falling through to String(), which produces "[object Object]".
function scalar(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(scalar).filter(Boolean).join(', ')
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const s = scalar(v)
        return s ? `${fieldLabel(k)}: ${s}` : ''
      })
      .filter(Boolean)
      .join(' · ')
  }
  return String(value)
}

/**
 * Turns an answer into the lines the drawer renders. Strings, numbers and
 * arrays stay a single unlabelled line (exactly as before); objects become one
 * labelled line per non-empty field.
 */
export function answerLines(answer: unknown): AnswerLine[] {
  if (answer === null || answer === undefined) return []
  if (Array.isArray(answer)) {
    const value = scalar(answer)
    return value ? [{ value }] : []
  }
  if (typeof answer === 'object') {
    return Object.entries(answer as Record<string, unknown>)
      .map(([k, v]) => ({ label: fieldLabel(k), value: scalar(v) }))
      .filter((l) => l.value !== '')
  }
  const value = scalar(answer)
  return value === '' ? [] : [{ value }]
}
