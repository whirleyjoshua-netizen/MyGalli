import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

  it('fetches reels on mount', async () => {
    render(<CommunityKollab {...base} />)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/hubs/hub1/kollab/reels')
    })
  })

  it('does not fetch reels when in preview mode', () => {
    render(<CommunityKollab {...base} preview />)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('Make a reel', () => {
  it('shows Make a reel only when canStitch is true', () => {
    const { rerender } = render(<CommunityKollab {...base} canStitch total={3} />)
    expect(screen.getByRole('button', { name: /make a reel/i })).toBeInTheDocument()
    rerender(<CommunityKollab {...base} canStitch={false} total={3} />)
    expect(screen.queryByRole('button', { name: /make a reel/i })).toBeNull()
  })

  it('opens the request modal, submits, and plays the returned reel', async () => {
    const reelBody = {
      id: 'r1', title: 'Saturday', status: 'draft', createdAt: '2026-07-22T00:00:00.000Z',
      creator: { username: 'sam' }, runtimeSec: 30,
      clips: [{ dropId: 'd1', in: 0, out: 5, type: 'image', url: 'https://x/a.jpg', thumbnailUrl: null, caption: null, author: 'sam' }],
    }
    global.fetch = vi.fn(async (url: string, init?: any) => {
      if (init?.method === 'POST') return { ok: true, json: async () => reelBody }
      return { ok: true, json: async () => ({ reels: [] }) }
    }) as any
    render(<CommunityKollab {...base} canStitch total={3} />)
    fireEvent.click(screen.getByRole('button', { name: /make a reel/i }))
    expect(screen.getByRole('dialog', { name: /make a reel/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /make it/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Saturday' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('dialog', { name: /make a reel/i })).toBeNull()
  })

  it('shows an error and stays open when the request fails', async () => {
    global.fetch = vi.fn(async (url: string, init?: any) => {
      if (init?.method === 'POST') return { ok: false, json: async () => ({ error: 'No luck.' }) }
      return { ok: true, json: async () => ({ reels: [] }) }
    }) as any
    render(<CommunityKollab {...base} canStitch total={3} />)
    fireEvent.click(screen.getByRole('button', { name: /make a reel/i }))
    fireEvent.click(screen.getByRole('button', { name: /make it/i }))
    await waitFor(() => {
      expect(screen.getByText('No luck.')).toBeInTheDocument()
    })
    expect(screen.getByRole('dialog', { name: /make a reel/i })).toBeInTheDocument()
  })
})

describe('publishReel rollback', () => {
  it('reverts only the reel whose publish failed, leaving a concurrently-published reel intact', async () => {
    const reel1 = {
      id: 'r1', title: 'One', status: 'draft', createdAt: '2026-07-22T00:00:00.000Z',
      creator: { username: 'sam' }, runtimeSec: 10, clips: [],
    }
    const reel2 = {
      id: 'r2', title: 'Two', status: 'draft', createdAt: '2026-07-22T00:00:00.000Z',
      creator: { username: 'sam' }, runtimeSec: 10, clips: [],
    }

    // r1's PATCH stays pending until we resolve it ourselves, so we can land
    // r2's PATCH (which resolves immediately) first — proving the rollback
    // targets only r1 and doesn't clobber r2's already-applied change.
    let resolveFirstPatch: (v: any) => void = () => {}
    const firstPatchPromise = new Promise((resolve) => { resolveFirstPatch = resolve })

    global.fetch = vi.fn((url: string, init?: any) => {
      if (url === '/api/hubs/hub1/kollab/reels') {
        return Promise.resolve({ ok: true, json: async () => ({ reels: [reel1, reel2] }) })
      }
      if (url === '/api/hubs/hub1/kollab/reels/r1' && init?.method === 'PATCH') {
        return firstPatchPromise
      }
      if (url === '/api/hubs/hub1/kollab/reels/r2' && init?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({}) })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    }) as any

    render(<CommunityKollab {...base} isPrivileged />)
    fireEvent.click(screen.getByRole('button', { name: /see content/i }))
    fireEvent.click(screen.getByRole('tab', { name: /reels/i }))

    await waitFor(() => expect(screen.getByText('One')).toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: 'Publish' })).toHaveLength(2)

    // Click r1's Publish — its PATCH is left hanging.
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish' })[0])
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Publish' })).toHaveLength(1))

    // Click r2's Publish while r1's request is still in flight — resolves immediately.
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish' })[0])
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Unpublish' })).toHaveLength(2))

    // Now fail r1's request.
    resolveFirstPatch({ ok: false, json: async () => ({}) })

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Publish' })).toHaveLength(1)
    })
    // r2's optimistic update must have survived r1's rollback.
    expect(screen.getAllByRole('button', { name: 'Unpublish' })).toHaveLength(1)
  })
})

describe('deleteReel', () => {
  it('optimistically removes the reel and restores it on a failed DELETE', async () => {
    const reel1 = {
      id: 'r1', title: 'One', status: 'published', creatorId: 'u1', createdAt: '2026-07-22T00:00:00.000Z',
      creator: { username: 'sam' }, runtimeSec: 10, clips: [],
    }

    global.fetch = vi.fn((url: string, init?: any) => {
      if (url === '/api/hubs/hub1/kollab/reels') {
        return Promise.resolve({ ok: true, json: async () => ({ reels: [reel1] }) })
      }
      if (url === '/api/hubs/hub1/kollab/reels/r1' && init?.method === 'DELETE') {
        return Promise.resolve({ ok: false, json: async () => ({}) })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    }) as any

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<CommunityKollab {...base} isPrivileged />)
    fireEvent.click(screen.getByRole('button', { name: /see content/i }))
    fireEvent.click(screen.getByRole('tab', { name: /reels/i }))

    await waitFor(() => expect(screen.getByText('One')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    // Optimistically removed immediately.
    await waitFor(() => expect(screen.queryByText('One')).not.toBeInTheDocument())

    // The failed DELETE restores it.
    await waitFor(() => expect(screen.getByText('One')).toBeInTheDocument())
  })
})
