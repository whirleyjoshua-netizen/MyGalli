import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HubCommunitySection } from './HubCommunitySection'

beforeEach(() => {
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith('/posts')) return { ok: true, json: async () => ({ posts: [] }) } as Response
    return { ok: true, json: async () => ({ joined: true, memberCount: 1 }) } as Response
  }) as unknown as typeof fetch
})

describe('HubCommunitySection', () => {
  it('shows Join and posts to the join endpoint', async () => {
    render(<HubCommunitySection hubId="h1" initialJoined={false} memberCount={0} isPrivileged={false} />)
    const btn = await screen.findByText('Join')
    fireEvent.click(btn)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/hubs/h1/join', { method: 'POST' }))
  })
})
