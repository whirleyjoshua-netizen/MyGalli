import { describe, it, expect } from 'vitest'
import { createElement } from './canvas'

describe('createElement("lead-gen")', () => {
  it('creates a lead-gen element with friendly defaults and a stable id', () => {
    const el = createElement('lead-gen')
    expect(el.type).toBe('lead-gen')
    expect(el.id).toBeTruthy()
    expect(el.leadGenHeadline).toBe('Get my free guide')
    expect(el.leadGenButtonLabel).toBe('Send it to me')
    expect(el.leadGenMessage).toContain('Thanks')
    expect(el.leadGenSuccessText).toBe('Check your inbox! 📬')
    expect(el.leadGenCollectName).toBe(false)
    expect(el.leadGenFileUrl).toBeUndefined()
  })
})
