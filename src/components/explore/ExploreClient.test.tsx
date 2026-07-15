import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExploreClient } from './ExploreClient'

type MockUser = { username: string; name: string | null; avatar: string | null }
const mockUser = vi.hoisted(() => ({ current: null as MockUser | null }))
vi.mock('@/lib/store', () => ({ useAuthStore: () => ({ user: mockUser.current }) }))

const emptyRows = { trending: [], following: [], categories: [] }

beforeEach(() => {
  vi.clearAllMocks()
  mockUser.current = { username: 'josh', name: 'Josh', avatar: null }
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ displays: [] }) } as Response))
  )
})

describe('ExploreClient header', () => {
  it('renders the brand, Home link, and search box', () => {
    render(<ExploreClient initialRows={emptyRows} />)
    expect(screen.getByText('My Galli')).toBeInTheDocument()
    expect(screen.getByLabelText('Home')).toHaveAttribute('href', '/dashboard')
    expect(screen.getByLabelText('Search')).toBeInTheDocument()
  })

  it('renders the account avatar initial linking to the profile', () => {
    render(<ExploreClient initialRows={emptyRows} />)
    expect(screen.getByLabelText('Your profile')).toHaveAttribute('href', '/josh')
  })

  it('renders the category chips sub-bar', () => {
    render(<ExploreClient initialRows={emptyRows} />)
    // Labels come from CATEGORIES in src/lib/categories.ts
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sports & Athletics/ })).toBeInTheDocument()
  })

  it('typing in search drives the /api/explore fetch', async () => {
    render(<ExploreClient initialRows={emptyRows} />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'surf' } })
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('search=surf'))
    })
  })

  it('clears the search box via the clear button', () => {
    render(<ExploreClient initialRows={emptyRows} />)
    const input = screen.getByLabelText('Search') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'surf' } })
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(input.value).toBe('')
  })

  // Guards the refactor: without this, the later extraction could drop the
  // sticky wrapper and every other test here would still pass. Stickiness IS
  // the feature. jsdom does no layout, so the Tailwind class is the only observable.
  it('renders the header bar pinned to the top of the viewport', () => {
    const { container } = render(<ExploreClient initialRows={emptyRows} />)
    expect(container.querySelector('.sticky.top-0.z-20')).toBeInTheDocument()
  })

  // Logged-out characterization, scoped to what the refactor must NOT change.
  // Deliberately does NOT assert the Home href: a later task intentionally
  // changes it from /dashboard to / for logged-out visitors, so asserting
  // today's value here would be a test built to be broken.
  it('shows the Log in link and no avatar when logged out', () => {
    mockUser.current = null
    render(<ExploreClient initialRows={emptyRows} />)
    expect(screen.getByLabelText('Log in')).toHaveAttribute('href', '/login')
    expect(screen.queryByLabelText('Your profile')).not.toBeInTheDocument()
  })
})
