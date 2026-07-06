import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PagesTree } from './PagesTree'

const displays = [
  { id: 'p1', title: 'Listing 123', kind: 'page' },
  { id: 'p2', title: 'About Me', kind: 'page' },
  { id: 'b1', title: 'My Board', kind: 'collection' },
]
const hubData = { hubs: [{ id: 'h1', title: 'Deal Room', displayId: 'p1' }] }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(url === '/api/displays' ? displays : hubData) } as Response),
  ))
})
afterEach(() => vi.unstubAllGlobals())

describe('PagesTree', () => {
  it('lists pages (not boards) with hubs nested as branches', async () => {
    render(<PagesTree />)
    const page = await screen.findByRole('link', { name: /listing 123/i })
    expect(page).toHaveAttribute('href', '/editor?id=p1')
    expect(screen.getByRole('link', { name: /about me/i })).toHaveAttribute('href', '/editor?id=p2')
    // hub nested under its page → links to the hub editor
    expect(screen.getByRole('link', { name: /deal room/i })).toHaveAttribute('href', '/hubs/h1')
    // boards are excluded from the page tree
    expect(screen.queryByText('My Board')).toBeNull()
  })
})
