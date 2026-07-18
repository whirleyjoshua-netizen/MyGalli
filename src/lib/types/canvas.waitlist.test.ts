import { describe, it, expect } from 'vitest'
import { createElement } from './canvas'

describe("createElement('waitlist')", () => {
  it('returns sane defaults', () => {
    const el = createElement('waitlist') as any
    expect(el.type).toBe('waitlist')
    expect(el.waitlistStyle).toBe('hero')
    expect(el.waitlistButtonLabel).toBe('Join Wait List')
    expect(el.waitlistShowCount).toBe(true)
    expect(el.waitlistShowCountdown).toBe(true)
    expect(el.waitlistCollectName).toBe(false)
    expect(el.waitlistConfirmationMessage).toContain("on the list")
    expect(el.waitlistCapacity ?? null).toBeNull()
    expect(el.id).toBeTruthy()
  })
})
