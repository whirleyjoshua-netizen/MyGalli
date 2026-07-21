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
})
