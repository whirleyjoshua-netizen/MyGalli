import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExploreClient } from './ExploreClient'

vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { username: 'josh', name: 'Josh', avatar: null } }),
}))

const emptyRows = { trending: [], following: [], categories: [] }

beforeEach(() => {
  vi.clearAllMocks()
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
})
