import { describe, it, expect } from 'vitest'
import { LINKABLE_ITEM_TYPES, linkableItems, visibleNotes, resolveNoteLink, toStripNote } from './hub-notes'

describe('LINKABLE_ITEM_TYPES', () => {
  it('includes file/link/embed but not note', () => {
    expect([...LINKABLE_ITEM_TYPES].sort()).toEqual(['embed', 'file', 'link'])
    expect(LINKABLE_ITEM_TYPES.has('note')).toBe(false)
  })
})

describe('linkableItems', () => {
  it('keeps only linkable types', () => {
    const items = [
      { id: 'a', type: 'file' },
      { id: 'b', type: 'note' },
      { id: 'c', type: 'link' },
      { id: 'd', type: 'embed' },
    ]
    expect(linkableItems(items).map((i) => i.id)).toEqual(['a', 'c', 'd'])
  })
})

describe('visibleNotes', () => {
  const notes = [
    { id: 'p', visibility: 'public' },
    { id: 's', visibility: 'private' },
  ]
  it('owner sees all', () => {
    expect(visibleNotes(notes, true).map((n) => n.id)).toEqual(['p', 's'])
  })
  it('visitor sees only public', () => {
    expect(visibleNotes(notes, false).map((n) => n.id)).toEqual(['p'])
  })
})

describe('resolveNoteLink', () => {
  const items = [
    { id: 'x', url: 'https://example.com/file.pdf' },
    { id: 'y', url: 'javascript:alert(1)' },
    { id: 'z', url: null },
  ]
  it('returns null when unlinked', () => {
    expect(resolveNoteLink({ linkedItemId: null }, items)).toBeNull()
  })
  it('returns null when the linked item is missing', () => {
    expect(resolveNoteLink({ linkedItemId: 'gone' }, items)).toBeNull()
  })
  it('resolves a safe href for a linked item', () => {
    expect(resolveNoteLink({ linkedItemId: 'x' }, items)).toBe('https://example.com/file.pdf')
  })
  it('returns null for an unsafe href', () => {
    expect(resolveNoteLink({ linkedItemId: 'y' }, items)).toBeNull()
  })
  it('returns null when the linked item has no url', () => {
    expect(resolveNoteLink({ linkedItemId: 'z' }, items)).toBeNull()
  })
})

describe('toStripNote', () => {
  const row = {
    id: 'n1', title: 'Welcome', content: 'Share ideas', color: '#FDE047',
    visibility: 'private', linkedItemId: 'item1', order: 3, minimized: false,
  }

  it('maps only the fields the strip renders', () => {
    expect(toStripNote(row)).toEqual({
      id: 'n1', title: 'Welcome', content: 'Share ideas', color: '#FDE047',
    })
  })

  // The DTO crosses to the client; visibility/linkedItemId must not ride along.
  it('omits visibility and linkedItemId', () => {
    const dto = toStripNote(row) as Record<string, unknown>
    expect(dto.visibility).toBeUndefined()
    expect(dto.linkedItemId).toBeUndefined()
  })
})
