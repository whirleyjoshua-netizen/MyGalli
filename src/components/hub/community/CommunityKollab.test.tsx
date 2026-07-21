import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommunityKollab } from './CommunityKollab'
import type { DropDTO } from '@/lib/hub-drops'

const drop = (over: Partial<DropDTO> = {}): DropDTO => ({
  id: 'd1', type: 'image', url: 'https://x/a.jpg', thumbnailUrl: null, caption: null,
  mimeType: null, width: null, height: null, status: 'approved',
  createdAt: '2026-07-21T00:00:00.000Z',
  author: { userId: 'u1', username: 'sam', name: 'Sam', avatar: null },
  ...over,
})

const base = {
  hubId: 'hub1', hubTitle: 'Frog Club', canDrop: true, isPrivileged: false,
  currentUserId: 'u1', enabled: true, initialDrops: [drop()], total: 1, pendingCount: 0,
}

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ drops: [], nextCursor: null }) })) as any
})

describe('CommunityKollab', () => {
  it('renders the tile, not a thumbnail grid', () => {
    const { container } = render(<CommunityKollab {...base} />)
    expect(screen.getByRole('img', { name: 'Kollab' })).toBeInTheDocument()
    expect(container.querySelectorAll('img[src="https://x/a.jpg"]')).toHaveLength(0)
  })

  it('renders nothing when the pool is disabled', () => {
    const { container } = render(<CommunityKollab {...base} enabled={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens the viewer from See content', async () => {
    render(<CommunityKollab {...base} />)
    fireEvent.click(screen.getByRole('button', { name: /see content/i }))
    expect(screen.getByRole('dialog', { name: 'Kollab' })).toBeInTheDocument()
  })

  it('surfaces the pending count to a moderator', () => {
    render(<CommunityKollab {...base} isPrivileged pendingCount={2} />)
    expect(screen.getByText('2 awaiting review')).toBeInTheDocument()
  })
})
