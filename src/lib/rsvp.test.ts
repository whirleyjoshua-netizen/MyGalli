import { describe, it, expect } from 'vitest'
import { collectRsvpGuests, summarizeRsvp, buildItemBoard, type RsvpFormResponse } from './rsvp'

const EL = 'el-rsvp-1'

function resp(answer: Record<string, unknown>, type = 'rsvp'): RsvpFormResponse {
  return { responses: { [EL]: { type, question: 'Party', answer } }, submittedAt: new Date('2026-07-03T00:00:00Z') }
}

describe('collectRsvpGuests', () => {
  it('extracts only rsvp entries for the given element id', () => {
    const responses: RsvpFormResponse[] = [
      resp({ name: 'Maya', attending: 'going', guests: 2, items: ['Salad'] }),
      resp({ name: 'Jon', attending: 'cant' }),
      resp({ name: 'X', attending: 'going' }, 'poll'), // wrong type — ignored
      { responses: { 'other-el': { type: 'rsvp', answer: { name: 'Nope' } } }, submittedAt: new Date() }, // other element
    ]
    const guests = collectRsvpGuests(EL, responses)
    expect(guests.map((g) => g.name)).toEqual(['Maya', 'Jon'])
    expect(guests[0]).toMatchObject({ name: 'Maya', attending: 'going', guests: 2, items: ['Salad'] })
  })

  it('normalizes bad values: unknown status -> going, negative/NaN guests -> 0, non-string items dropped', () => {
    const [g] = collectRsvpGuests(EL, [resp({ name: '  ', attending: 'nope', guests: -5, items: ['Ice', 42] })])
    expect(g.attending).toBe('going')
    expect(g.guests).toBe(0)
    expect(g.items).toEqual(['Ice'])
    expect(g.name).toBe('Anonymous') // blank name falls back
  })
})

describe('summarizeRsvp', () => {
  it('counts by status and totals heads as going + their +1s (maybe/cant excluded)', () => {
    const guests = collectRsvpGuests(EL, [
      resp({ name: 'A', attending: 'going', guests: 2 }),
      resp({ name: 'B', attending: 'going', guests: 0 }),
      resp({ name: 'C', attending: 'maybe', guests: 3 }),
      resp({ name: 'D', attending: 'cant' }),
    ])
    const { counts } = summarizeRsvp(guests)
    expect(counts).toEqual({ going: 2, maybe: 1, cant: 1, responses: 4, totalGuests: 4 }) // (1+2) + (1+0)
  })
})

describe('buildItemBoard', () => {
  it('maps each preset item to who claimed it and flags open items', () => {
    const guests = collectRsvpGuests(EL, [
      resp({ name: 'Maya', attending: 'going', items: ['Salad', 'Ice'] }),
      resp({ name: 'Jon', attending: 'going', items: ['Salad'] }),
    ])
    const board = buildItemBoard(['Salad', 'Ice', 'Dessert'], guests)
    expect(board).toEqual([
      { label: 'Salad', claimedBy: ['Maya', 'Jon'], claimed: true },
      { label: 'Ice', claimedBy: ['Maya'], claimed: true },
      { label: 'Dessert', claimedBy: [], claimed: false },
    ])
  })
})
