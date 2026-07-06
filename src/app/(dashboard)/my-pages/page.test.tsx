import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MyPagesPage from './page'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/store', () => ({ useAuthStore: () => ({ user: { username: 'josh' } }) }))

const iso = new Date(0).toISOString()
const rows = [
  { id: 'p1', title: 'My Page', slug: 'my-page', published: true, views: 0, updatedAt: iso, kind: 'page', _count: { elements: 0 } },
  { id: 'b1', title: 'My Board', slug: 'my-board', published: true, views: 0, updatedAt: iso, kind: 'collection', _count: { elements: 0 } },
]
const hubRows = {
  hubs: [
    { id: 'h1', title: 'My Hub', slug: 'my-hub', displayId: 'p1', coverImage: null, _count: { items: 3, folders: 1 } },
  ],
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(url === '/api/displays' ? rows : url === '/api/hubs' ? hubRows : {}),
    } as Response),
  ))
})
afterEach(() => vi.unstubAllGlobals())

describe('Gallery (my-pages) tabs', () => {
  it('heading is Gallery with Pages and Boards tabs', async () => {
    render(<MyPagesPage />)
    expect(screen.getByRole('heading', { name: 'Gallery' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /pages/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /boards/i })).toBeInTheDocument()
  })

  it('Pages tab shows only pages; switching to Boards shows only boards', async () => {
    render(<MyPagesPage />)
    expect(await screen.findByText('My Page')).toBeInTheDocument()
    expect(screen.queryByText('My Board')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /boards/i }))
    expect(await screen.findByText('My Board')).toBeInTheDocument()
    expect(screen.queryByText('My Page')).toBeNull()
  })

  it('Hubs tab lists hubs linking to editor, hiding page/board cards', async () => {
    render(<MyPagesPage />)
    expect(await screen.findByRole('button', { name: /hubs/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /hubs/i }))
    const hubLink = await screen.findByText('My Hub')
    expect(hubLink).toBeInTheDocument()
    const anchor = hubLink.closest('a')
    expect(anchor).toHaveAttribute('href', '/hubs/h1')

    expect(screen.queryByText('My Page')).toBeNull()
    expect(screen.queryByText('My Board')).toBeNull()
  })
})
