import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { KollabViewer } from './KollabViewer'
import type { DropDTO } from '@/lib/hub-drops'

const drop = (over: Partial<DropDTO> = {}): DropDTO => ({
  id: 'd1', type: 'image', url: 'https://x/a.jpg', thumbnailUrl: null, caption: null,
  mimeType: null, width: null, height: null, status: 'approved',
  createdAt: '2026-07-21T00:00:00.000Z',
  author: { userId: 'u1', username: 'sam', name: 'Sam', avatar: null },
  ...over,
})

const base = {
  hubId: 'hub1', currentUserId: 'owner', initialDrops: [drop()], total: 1,
  // Default to the unprivileged case so a test that forgets to say which viewer
  // it is gets the safer one; every moderator test passes `isPrivileged` itself.
  isPrivileged: false,
  onClose: () => {}, onApprovedCountChange: () => {}, onPendingCountChange: () => {},
}

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ drops: [], nextCursor: null }) })) as any
})
afterEach(() => vi.restoreAllMocks())

describe('KollabViewer', () => {
  it('hides the Pending tab from a non-privileged viewer', () => {
    render(<KollabViewer {...base} isPrivileged={false} />)
    expect(screen.queryByRole('tab', { name: /pending/i })).not.toBeInTheDocument()
  })

  it('shows the Pending tab to a moderator', () => {
    render(<KollabViewer {...base} isPrivileged />)
    expect(screen.getByRole('tab', { name: /pending/i })).toBeInTheDocument()
  })

  it('fetches pending drops only when the tab is opened', async () => {
    render(<KollabViewer {...base} isPrivileged />)
    expect(global.fetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('tab', { name: /pending/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/hubs/hub1/drops?status=pending')
    })
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<KollabViewer {...base} isPrivileged={false} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('moves an approved drop out of Pending and into Approved', async () => {
    ;(global.fetch as any) = vi.fn(async (url: string, init?: any) => {
      if (init?.method === 'PATCH') return { ok: true, json: async () => ({ ok: true, status: 'approved' }) }
      return { ok: true, json: async () => ({ drops: [drop({ id: 'p1', status: 'pending' })], nextCursor: null }) }
    })
    render(<KollabViewer {...base} isPrivileged />)
    fireEvent.click(screen.getByRole('tab', { name: /pending/i }))
    await screen.findByRole('button', { name: /approve/i })
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() => {
      expect(screen.getByText('Nothing waiting for review.')).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: /approved \(2\)/i })).toBeInTheDocument()
  })

  it('rolls back an approve when the PATCH fails', async () => {
    ;(global.fetch as any) = vi.fn(async (url: string, init?: any) => {
      if (init?.method === 'PATCH') return { ok: false, json: async () => ({}) }
      return { ok: true, json: async () => ({ drops: [drop({ id: 'p1', status: 'pending' })], nextCursor: null }) }
    })
    render(<KollabViewer {...base} isPrivileged />)
    fireEvent.click(screen.getByRole('tab', { name: /pending/i }))
    await screen.findByRole('button', { name: /approve/i })
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: /approved \(1\)/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /approved/i }))
    expect(screen.queryByText(/p1/)).not.toBeInTheDocument()
  })

  it('rejects a pending drop after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    ;(global.fetch as any) = vi.fn(async (url: string, init?: any) => {
      if (init?.method === 'PATCH') return { ok: true, json: async () => ({ ok: true }) }
      return { ok: true, json: async () => ({ drops: [drop({ id: 'p1', status: 'pending' })], nextCursor: null }) }
    })
    render(<KollabViewer {...base} isPrivileged />)
    fireEvent.click(screen.getByRole('tab', { name: /pending/i }))
    await screen.findByRole('button', { name: /reject/i })
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    await waitFor(() => {
      expect(screen.getByText('Nothing waiting for review.')).toBeInTheDocument()
    })
    const patchCall = (global.fetch as any).mock.calls.find((c: any[]) => c[1]?.method === 'PATCH')
    expect(patchCall).toBeTruthy()
    expect(JSON.parse(patchCall[1].body)).toEqual({ action: 'reject' })
    fireEvent.click(screen.getByRole('tab', { name: /approved/i }))
    expect(screen.queryByText(/p1/)).not.toBeInTheDocument()
  })

  it('rolls back a reject when the PATCH fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    ;(global.fetch as any) = vi.fn(async (url: string, init?: any) => {
      if (init?.method === 'PATCH') return { ok: false, json: async () => ({}) }
      return { ok: true, json: async () => ({ drops: [drop({ id: 'p1', status: 'pending' })], nextCursor: null }) }
    })
    render(<KollabViewer {...base} isPrivileged />)
    fireEvent.click(screen.getByRole('tab', { name: /pending/i }))
    await screen.findByRole('button', { name: /reject/i })
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
    })
  })

  it('leaves an item out of Pending on a 409 (another moderator already reviewed it) instead of restoring it', async () => {
    ;(global.fetch as any) = vi.fn(async (url: string, init?: any) => {
      if (init?.method === 'PATCH') return { ok: false, status: 409, json: async () => ({ error: 'already reviewed' }) }
      return { ok: true, json: async () => ({ drops: [drop({ id: 'p1', status: 'pending' })], nextCursor: null }) }
    })
    render(<KollabViewer {...base} isPrivileged />)
    fireEvent.click(screen.getByRole('tab', { name: /pending/i }))
    await screen.findByRole('button', { name: /approve/i })
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() => {
      expect(screen.getByText('Someone else already reviewed that one.')).toBeInTheDocument()
    })
    // Unlike a 500, a 409 must NOT put the item back into Pending.
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    expect(screen.getByText('Nothing waiting for review.')).toBeInTheDocument()
  })

  it('still restores an item to Pending on a plain 500, distinct from the 409 case', async () => {
    ;(global.fetch as any) = vi.fn(async (url: string, init?: any) => {
      if (init?.method === 'PATCH') return { ok: false, status: 500, json: async () => ({}) }
      return { ok: true, json: async () => ({ drops: [drop({ id: 'p1', status: 'pending' })], nextCursor: null }) }
    })
    render(<KollabViewer {...base} isPrivileged />)
    fireEvent.click(screen.getByRole('tab', { name: /pending/i }))
    await screen.findByRole('button', { name: /approve/i })
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() => {
      expect(screen.getByText('That didn’t go through. Try again.')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
  })

  it('shows an error instead of the empty-queue copy when the pending fetch fails', async () => {
    ;(global.fetch as any) = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    render(<KollabViewer {...base} isPrivileged pendingCount={3} />)
    fireEvent.click(screen.getByRole('tab', { name: /pending/i }))
    await waitFor(() => {
      expect(screen.getByText(/couldn.t load the pending queue/i)).toBeInTheDocument()
    })
    expect(screen.queryByText('Nothing waiting for review.')).not.toBeInTheDocument()
    // The badge must keep showing the real (pre-fetch) count, not drop to 0.
    expect(screen.getByRole('tab', { name: /pending \(3\)/i })).toBeInTheDocument()
  })

  it('does not call PATCH when the reject confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    ;(global.fetch as any) = vi.fn(async (url: string, init?: any) => {
      if (init?.method === 'PATCH') return { ok: true, json: async () => ({ ok: true }) }
      return { ok: true, json: async () => ({ drops: [drop({ id: 'p1', status: 'pending' })], nextCursor: null }) }
    })
    render(<KollabViewer {...base} isPrivileged />)
    fireEvent.click(screen.getByRole('tab', { name: /pending/i }))
    await screen.findByRole('button', { name: /reject/i })
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled()
    })
    const patchCall = (global.fetch as any).mock.calls.find((c: any[]) => c[1]?.method === 'PATCH')
    expect(patchCall).toBeFalsy()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
  })

  it('shows the pendingCount prop before the Pending tab has loaded', () => {
    render(<KollabViewer {...base} isPrivileged pendingCount={3} />)
    expect(screen.getByRole('tab', { name: /pending \(3\)/i })).toBeInTheDocument()
  })

  it('hides Load more once the server reports the pool exhausted, even if total says more remain', async () => {
    ;(global.fetch as any) = vi.fn(async () => ({ ok: true, json: async () => ({ drops: [], nextCursor: null }) }))
    render(<KollabViewer {...base} total={5} />)
    const loadMore = screen.getByRole('button', { name: /load more/i })
    fireEvent.click(loadMore)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
    })
  })

  it('opens on the Pending tab and fetches it when initialTab is pending for a moderator', async () => {
    render(<KollabViewer {...base} isPrivileged initialTab="pending" />)
    expect(screen.getByRole('tab', { name: /pending/i })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/hubs/hub1/drops?status=pending')
    })
  })

  it('ignores initialTab="pending" for a non-privileged viewer and lands on Approved', () => {
    render(<KollabViewer {...base} isPrivileged={false} initialTab="pending" />)
    expect(screen.getByRole('tab', { name: /approved/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('pages the Pending tab with Load more, appending without duplicating', async () => {
    let call = 0
    ;(global.fetch as any) = vi.fn(async (url: string) => {
      call += 1
      if (String(url).includes('status=pending')) {
        if (call === 1) {
          return { ok: true, json: async () => ({ drops: [drop({ id: 'p1', status: 'pending' })], nextCursor: 'p1' }) }
        }
        return { ok: true, json: async () => ({ drops: [drop({ id: 'p2', status: 'pending' })], nextCursor: null }) }
      }
      return { ok: true, json: async () => ({ drops: [], nextCursor: null }) }
    })
    render(<KollabViewer {...base} isPrivileged />)
    fireEvent.click(screen.getByRole('tab', { name: /pending/i }))
    await screen.findByRole('button', { name: /load more/i })
    fireEvent.click(screen.getByRole('button', { name: /load more/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/hubs/hub1/drops?status=pending&cursor=p1')
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
    })
  })
})
