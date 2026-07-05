import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BulletinTab } from './BulletinTab'

vi.mock('@/lib/store', () => ({ useAuthStore: () => ({ user: { id: 'me' } }) }))
vi.mock('./BulletinComposer', () => ({ BulletinComposer: () => <div data-testid="composer" /> }))
vi.mock('./BulletinPostCard', () => ({ BulletinPostCard: () => <div data-testid="post" /> }))

describe('BulletinTab', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ posts: [] }) })) as unknown as typeof fetch)
  })

  it('loads the Following feed by default', async () => {
    render(<BulletinTab />)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/bulletin/feed')))
  })

  it('fetches the trending endpoint when the Trending tab is selected', async () => {
    render(<BulletinTab />)
    fireEvent.click(screen.getByRole('button', { name: /trending/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/bulletin/trending')))
  })
})
