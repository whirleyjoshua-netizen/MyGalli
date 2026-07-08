import { describe, it, expect } from 'vitest'
import { selectionRectsToPdf, pdfRectsToStyle, visibleBookmarks, bookmarkColor } from './hub-highlight'

describe('selectionRectsToPdf', () => {
  it('converts screen rects to unscaled page coords', () => {
    const page = { left: 100, top: 50 }
    const rects = [{ left: 110, top: 70, width: 40, height: 12 }]
    expect(selectionRectsToPdf(rects, page, 2)).toEqual([{ x: 5, y: 10, w: 20, h: 6 }])
  })
  it('handles multi-line (multi-rect) selections', () => {
    const page = { left: 0, top: 0 }
    const rects = [
      { left: 0, top: 0, width: 10, height: 10 },
      { left: 0, top: 10, width: 30, height: 10 },
    ]
    expect(selectionRectsToPdf(rects, page, 1)).toEqual([
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 0, y: 10, w: 30, h: 10 },
    ])
  })
})

describe('pdfRectsToStyle round-trips selectionRectsToPdf', () => {
  it('× scale inverts ÷ scale', () => {
    const page = { left: 100, top: 50 }
    const screen = [{ left: 110, top: 70, width: 40, height: 12 }]
    const pdf = selectionRectsToPdf(screen, page, 2)
    expect(pdfRectsToStyle(pdf, 2)).toEqual([{ left: 10, top: 20, width: 40, height: 12 }])
  })
})

describe('visibleBookmarks', () => {
  const bms = [{ noteId: 'pub' }, { noteId: 'priv' }, { noteId: 'gone' }]
  const vis = { pub: 'public', priv: 'private' }
  it('owner sees all', () => {
    expect(visibleBookmarks(bms, vis, true)).toHaveLength(3)
  })
  it('visitor sees only bookmarks of public notes', () => {
    expect(visibleBookmarks(bms, vis, false).map((b) => b.noteId)).toEqual(['pub'])
  })
})

describe('bookmarkColor', () => {
  it('resolves the note color, else fallback', () => {
    expect(bookmarkColor('a', { a: '#123456' })).toBe('#123456')
    expect(bookmarkColor('missing', {}, '#FDE047')).toBe('#FDE047')
  })
})
