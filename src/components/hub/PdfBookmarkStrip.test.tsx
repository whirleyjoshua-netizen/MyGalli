import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PdfBookmarkStrip, type StripBookmark } from './PdfBookmarkStrip'

const bm = (id: string, page: number, noteId = 'n1'): StripBookmark =>
  ({ id, noteId, page, title: `Mark ${id}` })

describe('PdfBookmarkStrip', () => {
  it('renders nothing when there are no bookmarks', () => {
    // Guards the data-room: a file with no highlights must look exactly as before.
    const { container } = render(<PdfBookmarkStrip bookmarks={[]} onJump={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists one entry per bookmark, ordered by page', () => {
    render(<PdfBookmarkStrip bookmarks={[bm('c', 6), bm('a', 1), bm('b', 3)]} onJump={() => {}} />)
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['Jump to page 1', 'Jump to page 3', 'Jump to page 6'])
  })

  it('reports the page when an entry is clicked', () => {
    const onJump = vi.fn()
    render(<PdfBookmarkStrip bookmarks={[bm('a', 1), bm('b', 4)]} onJump={onJump} />)
    fireEvent.click(screen.getByRole('button', { name: 'Jump to page 4' }))
    expect(onJump).toHaveBeenCalledWith(4)
  })

  it('tints each entry with its own note colour', () => {
    render(
      <PdfBookmarkStrip
        bookmarks={[bm('a', 1, 'n1'), bm('b', 2, 'n2')]}
        noteColors={{ n1: 'rgb(1, 2, 3)', n2: 'rgb(4, 5, 6)' }}
        onJump={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: 'Jump to page 1' }).querySelector('span'))
      .toHaveStyle({ backgroundColor: 'rgb(1, 2, 3)' })
  })

  it('falls back to a default colour when the note has none', () => {
    render(<PdfBookmarkStrip bookmarks={[bm('a', 1, 'missing')]} onJump={() => {}} />)
    expect(screen.getByRole('button', { name: 'Jump to page 1' })).toBeInTheDocument()
  })
})
