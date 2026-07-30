import { describe, it, expect } from 'vitest'
import { validateEdl, edlRuntime, EDL_SCHEMA, type Edl } from './edl'

const cands = [
  { id: 'd1', durationSec: 10 },
  { id: 'd2', durationSec: null },
  { id: 'd3', durationSec: 4 },
]
const ok = (clips: unknown, title = 'Saturday') => validateEdl({ title, clips }, cands, 30)

describe('EDL_SCHEMA', () => {
  it('forbids extra properties so the model cannot smuggle fields', () => {
    expect((EDL_SCHEMA as any).additionalProperties).toBe(false)
  })
})

describe('validateEdl', () => {
  it('accepts a well-formed list', () => {
    const r = ok([{ dropId: 'd1', in: 0, out: 3 }, { dropId: 'd3', in: 1, out: 3.5 }])
    expect(r.ok).toBe(true)
    expect(r.ok && r.value.clips).toHaveLength(2)
    expect(r.ok && r.value.title).toBe('Saturday')
  })

  it('rejects a dropId outside the candidate set', () => {
    const r = ok([{ dropId: 'evil', in: 0, out: 3 }])
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/unknown clip/i)
  })

  it('rejects inverted or zero-length in/out', () => {
    expect(ok([{ dropId: 'd1', in: 5, out: 5 }]).ok).toBe(false)
    expect(ok([{ dropId: 'd1', in: 5, out: 2 }]).ok).toBe(false)
  })

  it('rejects a negative or non-finite bound', () => {
    expect(ok([{ dropId: 'd1', in: -1, out: 3 }]).ok).toBe(false)
    expect(ok([{ dropId: 'd1', in: 0, out: Infinity as any }]).ok).toBe(false)
  })

  it('rejects out beyond a known duration', () => {
    expect(ok([{ dropId: 'd3', in: 0, out: 9 }]).ok).toBe(false)
  })

  it('allows any out for an unknown duration — the player clamps', () => {
    expect(ok([{ dropId: 'd2', in: 0, out: 6 }]).ok).toBe(true)
  })

  it('rejects duplicate clips', () => {
    const r = ok([{ dropId: 'd1', in: 0, out: 2 }, { dropId: 'd1', in: 0, out: 2 }])
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/duplicate/i)
  })

  it('allows the same drop twice at different in-points', () => {
    expect(ok([{ dropId: 'd1', in: 0, out: 2 }, { dropId: 'd1', in: 4, out: 6 }]).ok).toBe(true)
  })

  it('rejects an empty clip list', () => {
    expect(ok([]).ok).toBe(false)
  })

  it('rejects more than 40 clips', () => {
    const many = Array.from({ length: 41 }, () => ({ dropId: 'd2', in: 0, out: 1 }))
    // distinct in-points so it fails on count, not the duplicate rule
    many.forEach((c, i) => { c.in = i; c.out = i + 1 })
    expect(ok(many).ok).toBe(false)
  })

  it('rejects a runtime more than 2x the target', () => {
    expect(ok([{ dropId: 'd2', in: 0, out: 61 }], 'Long').ok).toBe(false)
  })

  it('rejects a missing or empty title', () => {
    expect(validateEdl({ clips: [{ dropId: 'd1', in: 0, out: 2 }] }, cands, 30).ok).toBe(false)
    expect(validateEdl({ title: '   ', clips: [{ dropId: 'd1', in: 0, out: 2 }] }, cands, 30).ok).toBe(false)
  })

  it('truncates an overlong title rather than rejecting', () => {
    const r = validateEdl({ title: 'x'.repeat(200), clips: [{ dropId: 'd1', in: 0, out: 2 }] }, cands, 30)
    expect(r.ok && r.value.title.length).toBe(80)
  })

  it('rejects a non-object', () => {
    expect(validateEdl(null, cands, 30).ok).toBe(false)
    expect(validateEdl('nope', cands, 30).ok).toBe(false)
  })
})

describe('edlRuntime', () => {
  it('sums clip lengths', () => {
    const edl: Edl = { title: 't', clips: [{ dropId: 'd1', in: 0, out: 3 }, { dropId: 'd3', in: 1, out: 3.5 }] }
    expect(edlRuntime(edl)).toBeCloseTo(5.5)
  })

  it('is zero for no clips', () => {
    expect(edlRuntime({ title: 't', clips: [] })).toBe(0)
  })
})
