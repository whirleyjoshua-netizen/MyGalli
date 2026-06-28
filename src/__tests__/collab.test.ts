import { describe, it, expect } from 'vitest'
import { canEdit, splitUpdate, COLLAB_FIELDS } from '@/lib/collab'

describe('canEdit', () => {
  it('allows the owner', () => expect(canEdit('u1', 'u1', [])).toBe(true))
  it('allows a collaborator', () => expect(canEdit('u2', 'u1', ['u2'])).toBe(true))
  it('denies a stranger', () => expect(canEdit('u3', 'u1', ['u2'])).toBe(false))
  it('denies when not logged in', () => expect(canEdit(null, 'u1', [])).toBe(false))
})

describe('splitUpdate', () => {
  it('owner keeps all fields', () => {
    const r = splitUpdate({ title: 'x', sections: [], published: true }, true)
    expect(r.data).toEqual({ title: 'x', sections: [], published: true })
    expect(r.rejected).toEqual([])
  })
  it('collaborator keeps only content fields and reports rejected', () => {
    const r = splitUpdate({ title: 'x', sections: [1], published: true, background: {} }, false)
    expect(r.data).toEqual({ sections: [1], background: {} })
    expect(r.rejected.sort()).toEqual(['published', 'title'])
  })
  it('exposes the content field list', () => {
    expect(COLLAB_FIELDS).toContain('sections')
  })
})
