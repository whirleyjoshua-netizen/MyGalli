import { describe, it, expect } from 'vitest'
import { newNoteBody, bookmarkUrl } from './hub-bookmark-requests'

describe('newNoteBody', () => {
  it('titles the note after its source file and marks it public', () => {
    // Both matter: the note also appears in the Home tab's Notes card, where a
    // blank title reads as an unexplained empty entry; and a non-public note
    // would hide every highlight under it from members.
    expect(newNoteBody('Q3 Deck.pdf')).toEqual({
      title: 'Notes on Q3 Deck.pdf',
      content: '',
      visibility: 'public',
    })
  })

  it('truncates a long file name to the route cap of 200 chars', () => {
    expect(newNoteBody('x'.repeat(400)).title.length).toBe(200)
  })
})

describe('bookmarkUrl', () => {
  it('nests the bookmark under its note', () => {
    expect(bookmarkUrl('h1', 'n1')).toBe('/api/hubs/h1/notes/n1/bookmarks')
  })
})
