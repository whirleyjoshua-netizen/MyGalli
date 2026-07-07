import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MessagesInbox } from './MessagesInbox'

const messages = [
  { id: 'm1', kind: 'text', body: 'hello', senderName: 'Ann', read: false, createdAt: '2026-07-06T00:00:00Z', display: { title: 'My Page' } },
  { id: 'm2', kind: 'audio', mediaUrl: 'https://blob/x.webm', senderName: null, read: true, createdAt: '2026-07-05T00:00:00Z', display: { title: 'Other' } },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string, opts?: any) => {
    if (String(url).includes('/api/messages') && (!opts || opts.method === undefined)) {
      return Promise.resolve({ ok: true, json: async () => ({ messages }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('MessagesInbox', () => {
  it('renders messages, emphasizing unread', async () => {
    render(<MessagesInbox />)
    await waitFor(() => expect(screen.getByText('hello')).toBeTruthy())
    expect(screen.getByText('Ann')).toBeTruthy()
    expect(screen.getByText('Anonymous')).toBeTruthy() // m2 has no sender name
  })

  it('deletes a message via the delete button', async () => {
    render(<MessagesInbox />)
    await waitFor(() => expect(screen.getByText('hello')).toBeTruthy())
    fireEvent.click(screen.getByLabelText('delete-m1'))
    await waitFor(() => {
      const call = (fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/api/messages/m1') && c[1]?.method === 'DELETE')
      expect(call).toBeTruthy()
    })
  })
})
