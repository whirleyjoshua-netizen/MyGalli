// src/components/dashboard/NotificationBell.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationBell } from './NotificationBell'

const rows = [
  { id: 'n1', type: 'follow', actorName: 'Sofia', actorAvatar: null, entityUrl: '/sofia', contextText: null, read: false, createdAt: new Date().toISOString() },
]

function jsonRes(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
    if (url === '/api/notifications/unread-count') return jsonRes({ count: 2 })
    if (url === '/api/notifications') return jsonRes({ notifications: rows })
    if (url === '/api/notifications/read') return jsonRes({ ok: true })
    return jsonRes({})
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('NotificationBell', () => {
  it('shows the unread badge from the poll', async () => {
    render(<NotificationBell />)
    expect(await screen.findByText('2')).toBeInTheDocument()
  })
  it('opens the dropdown, lists notifications, and marks them read', async () => {
    render(<NotificationBell />)
    await screen.findByText('2')
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Sofia started following you')).toBeInTheDocument()
    await waitFor(() => {
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some((c) => c[0] === '/api/notifications/read')).toBe(true)
    })
  })
})
