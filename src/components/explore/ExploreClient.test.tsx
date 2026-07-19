import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExploreClient } from './ExploreClient'
import type { TrendingItem, ExploreCreator, ExploreCommunity } from '@/lib/explore'

const mockParams = vi.hoisted(() => ({ current: new URLSearchParams() }))
vi.mock('next/navigation', () => ({ useSearchParams: () => mockParams.current }))

const trending: TrendingItem[] = [
  {
    id: 't1', slug: 'my-page', title: 'My Cool Page', coverImage: null, views: 42,
    category: 'creative', kind: 'page', user: { username: 'josh', name: 'Josh', avatar: null }, followerCount: 3,
  },
]
const creators: ExploreCreator[] = [
  { id: 'u1', username: 'frog', name: 'Creative Frog', avatar: null, followerCount: 10, isFollowing: false },
]
const categoryCounts = { creative: 5, education: 2 }
const communities: ExploreCommunity[] = []

function renderClient() {
  return render(
    <ExploreClient trending={trending} creators={creators} categoryCounts={categoryCounts} communities={communities} />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockParams.current = new URLSearchParams()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ displays: [] }) } as Response)),
  )
})

describe('ExploreClient', () => {
  it('renders the Explore hero + subtitle and all type chips', () => {
    renderClient()
    expect(screen.getByRole('heading', { name: 'Explore', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/Discover pages, boards, hubs/)).toBeInTheDocument()
    for (const c of ['All', 'Pages', 'Boards', 'Hubs', 'People']) {
      expect(screen.getByRole('button', { name: c })).toBeInTheDocument()
    }
  })

  it('shows the All-mode sections with real data', () => {
    renderClient()
    expect(screen.getByText('Featured Collections')).toBeInTheDocument()
    expect(screen.getByText('Browse by Category')).toBeInTheDocument()
    expect(screen.getByText('Trending')).toBeInTheDocument()
    expect(screen.getByText('My Cool Page')).toBeInTheDocument()
    expect(screen.getByText('Explore Creators')).toBeInTheDocument()
    expect(screen.getByText('@frog')).toBeInTheDocument()
  })

  it('typing in search drives the /api/explore fetch', async () => {
    renderClient()
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'surf' } })
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('search=surf')))
  })

  it('switching to the People chip hides the section layout and shows creators', () => {
    renderClient()
    fireEvent.click(screen.getByRole('button', { name: 'People' }))
    expect(screen.queryByText('Featured Collections')).not.toBeInTheDocument()
    expect(screen.getByText('@frog')).toBeInTheDocument()
  })

  it('seeds the search box from ?search=', () => {
    mockParams.current = new URLSearchParams('search=surfing')
    renderClient()
    expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe('surfing')
  })
})
