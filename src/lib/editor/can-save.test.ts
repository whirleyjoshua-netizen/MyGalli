import { describe, it, expect } from 'vitest'
import { canSave } from './can-save'

const ready = { id: 'd1', saving: false, conflict: false, hasLoaded: true }

describe('canSave', () => {
  it('allows a save once the page is loaded', () => {
    expect(canSave(ready)).toBe(true)
  })

  it('refuses to write before the initial load has returned', () => {
    // The regression: `id` is set from the URL at mount, so the 5s autosave
    // would fire mid-load and PATCH blank defaults over a real document. A 16s
    // load on a freshly created board wiped its seeded collection-view every
    // time.
    expect(canSave({ ...ready, hasLoaded: false })).toBe(false)
  })

  it('refuses when there is no id yet', () => {
    expect(canSave({ ...ready, id: null })).toBe(false)
  })

  it('refuses while a save is already in flight', () => {
    expect(canSave({ ...ready, saving: true })).toBe(false)
  })

  it('refuses after a version conflict, until the user resolves it', () => {
    expect(canSave({ ...ready, conflict: true })).toBe(false)
  })

  it('does not rely on the version check to protect content', () => {
    // A row that has never been saved has version 0, which matches the
    // editor's initial versionRef — so the 409 guard does NOT fire there.
    // hasLoaded must stand on its own.
    expect(canSave({ id: 'brand-new', saving: false, conflict: false, hasLoaded: false })).toBe(false)
  })
})
