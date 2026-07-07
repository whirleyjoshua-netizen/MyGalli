import { describe, it, expect } from 'vitest'
import { resolveHubVisibility, signUnlockToken, readUnlockToken } from './hub-access'

// tree:  root: [F_pub, F_priv(pass), F_col(no pass)]; F_priv > [I1]; F_col > [I2]; root items [I0 public, I3 private+pass]
const folders = [
  { id: 'Fpub', parentId: null, visibility: 'public', hasPasscode: false },
  { id: 'Fpriv', parentId: null, visibility: 'private', hasPasscode: true },
  { id: 'Fcol', parentId: null, visibility: 'private', hasPasscode: false },
]
const items = [
  { id: 'I0', folderId: null, visibility: 'public', hasPasscode: false },
  { id: 'I1', folderId: 'Fpriv', visibility: 'public', hasPasscode: false },
  { id: 'I2', folderId: 'Fcol', visibility: 'public', hasPasscode: false },
  { id: 'I3', folderId: null, visibility: 'private', hasPasscode: true },
]

describe('resolveHubVisibility', () => {
  it('owner sees everything', () => {
    const m = resolveHubVisibility({ folders, items, viewer: 'owner', unlockedIds: new Set() })
    for (const id of ['Fpub','Fpriv','Fcol','I0','I1','I2','I3']) expect(m.get(id)).toBe('visible')
  })
  it('public: public visible, passcode-folder locked, collaborator-folder hidden', () => {
    const m = resolveHubVisibility({ folders, items, viewer: 'public', unlockedIds: new Set() })
    expect(m.get('Fpub')).toBe('visible')
    expect(m.get('I0')).toBe('visible')
    expect(m.get('Fpriv')).toBe('locked')   // outermost private w/ passcode
    expect(m.get('I1')).toBe('hidden')       // behind the locked gate
    expect(m.get('Fcol')).toBe('hidden')     // private, no passcode → collaborator-only
    expect(m.get('I2')).toBe('hidden')
    expect(m.get('I3')).toBe('locked')       // private item with its own passcode
  })
  it('public with Fpriv unlocked: its subtree becomes visible', () => {
    const m = resolveHubVisibility({ folders, items, viewer: 'public', unlockedIds: new Set(['Fpriv']) })
    expect(m.get('Fpriv')).toBe('visible')
    expect(m.get('I1')).toBe('visible')
    expect(m.get('Fcol')).toBe('hidden')     // unrelated
  })
  it('collaborator sees everything', () => {
    const m = resolveHubVisibility({ folders, items, viewer: 'collaborator', unlockedIds: new Set() })
    expect(m.get('Fcol')).toBe('visible')
    expect(m.get('I2')).toBe('visible')
  })
})

describe('unlock cookie', () => {
  it('sign → read round-trips scoped to hubId', () => {
    const t = signUnlockToken('hub1', ['a', 'b'])
    expect(readUnlockToken(t, 'hub1')).toEqual(['a', 'b'])
  })
  it('rejects a token for a different hub or a garbage token', () => {
    const t = signUnlockToken('hub1', ['a'])
    expect(readUnlockToken(t, 'hub2')).toEqual([])
    expect(readUnlockToken('garbage', 'hub1')).toEqual([])
    expect(readUnlockToken(undefined, 'hub1')).toEqual([])
  })
})
