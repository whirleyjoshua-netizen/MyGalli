// RSVP element — shared, pure aggregation helpers.
// Used by the public board endpoint (privacy-gated) and the owner analytics
// aggregator, so the two never drift. No IO here — easy to unit test.

export type RsvpAttending = 'going' | 'maybe' | 'cant'

const ATTENDING_VALUES: RsvpAttending[] = ['going', 'maybe', 'cant']

export interface RsvpAnswer {
  name?: string
  attending?: RsvpAttending
  guests?: number
  items?: string[]
  note?: string
}

export interface RsvpGuest {
  name: string
  attending: RsvpAttending
  guests: number
  items: string[]
  note?: string
  submittedAt: string
}

// A minimal shape matching a Prisma FormResponse row (only the fields we read).
export interface RsvpFormResponse {
  responses: unknown
  submittedAt?: Date | string | null
  sessionId?: string | null
}

function normalizeAttending(value: unknown): RsvpAttending {
  return ATTENDING_VALUES.includes(value as RsvpAttending) ? (value as RsvpAttending) : 'going'
}

// Pull every `rsvp` answer for a given element id out of the raw form responses.
export function collectRsvpGuests(elementId: string, responses: RsvpFormResponse[]): RsvpGuest[] {
  const guests: RsvpGuest[] = []
  for (const response of responses) {
    const data = response.responses as Record<string, { type?: string; answer?: RsvpAnswer }> | null
    const entry = data?.[elementId]
    if (!entry || entry.type !== 'rsvp') continue
    const answer = entry.answer || {}
    guests.push({
      name: (answer.name || '').trim() || 'Anonymous',
      attending: normalizeAttending(answer.attending),
      guests: Math.max(0, Math.floor(Number(answer.guests) || 0)),
      items: Array.isArray(answer.items) ? answer.items.filter((i): i is string => typeof i === 'string') : [],
      note: answer.note?.trim() || undefined,
      submittedAt:
        response.submittedAt instanceof Date
          ? response.submittedAt.toISOString()
          : (response.submittedAt as string) || '',
    })
  }
  return guests
}

export interface RsvpCounts {
  going: number
  maybe: number
  cant: number
  responses: number
  // Heads actually coming: one per "going" guest plus their +1s.
  totalGuests: number
}

export function summarizeRsvp(guests: RsvpGuest[]): {
  going: RsvpGuest[]
  maybe: RsvpGuest[]
  cant: RsvpGuest[]
  counts: RsvpCounts
} {
  const going = guests.filter((g) => g.attending === 'going')
  const maybe = guests.filter((g) => g.attending === 'maybe')
  const cant = guests.filter((g) => g.attending === 'cant')
  const totalGuests = going.reduce((sum, g) => sum + 1 + g.guests, 0)
  return {
    going,
    maybe,
    cant,
    counts: { going: going.length, maybe: maybe.length, cant: cant.length, responses: guests.length, totalGuests },
  }
}

export interface RsvpItemClaim {
  label: string
  claimedBy: string[]
  claimed: boolean
}

// For each preset item, who signed up to bring it (multiple allowed — v1 does
// not hard-lock claims). Items nobody took come back with claimed: false.
export function buildItemBoard(items: string[], guests: RsvpGuest[]): RsvpItemClaim[] {
  return items.map((label) => {
    const claimedBy = guests.filter((g) => g.items.includes(label)).map((g) => g.name)
    return { label, claimedBy, claimed: claimedBy.length > 0 }
  })
}
