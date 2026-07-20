import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MessagesClient } from './MessagesClient'

const push = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: push }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => '/messages',
}))
vi.mock('@/components/dashboard/MessagesInbox', () => ({
  MessagesInbox: () => <div>visitor notes list</div>,
}))

const conversation = {
  id: 'c1',
  state: 'accepted',
  starred: false,
  muted: false,
  unreadCount: 0,
  lastMessageAt: new Date().toISOString(),
  other: { id: 'them', username: 'sarah', name: 'Sarah Johnson', avatar: null, lastSeenAt: null, followsYou: false },
  preview: { body: 'Love your page!', kind: 'text', senderId: 'them', createdAt: new Date().toISOString() },
}

beforeEach(() => {
  vi.clearAllMocks()
  search = ''
  global.fetch = vi.fn(async (url: any, init?: any) => {
    const href = String(url)
    if (href.includes('/messages') && init?.method === 'POST') {
      return {
        ok: true,
        json: async () => ({
          message: {
            id: 'server1', conversationId: 'c1', senderId: 'me', kind: 'text',
            body: 'hi there', mediaUrl: null, createdAt: new Date().toISOString(),
          },
        }),
      } as any
    }
    if (href.includes('/messages')) return { ok: true, json: async () => ({ messages: [] }) } as any
    if (href.includes('/conversations')) {
      return { ok: true, json: async () => ({ conversations: [conversation] }) } as any
    }
    return { ok: true, json: async () => ({}) } as any
  }) as any
})

describe('MessagesClient', () => {
  it('loads and lists conversations', async () => {
    render(<MessagesClient myId="me" />)
    await waitFor(() => expect(screen.getByText('Sarah Johnson')).toBeInTheDocument())
  })

  it('puts the selected conversation in the URL', async () => {
    render(<MessagesClient myId="me" />)
    await waitFor(() => expect(screen.getByText('Sarah Johnson')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Sarah Johnson/ }))
    expect(push).toHaveBeenCalledWith('/messages?c=c1')
  })

  it('shows the visitor notes tab content when selected', async () => {
    render(<MessagesClient myId="me" />)
    fireEvent.click(screen.getByRole('button', { name: /Visitor notes/i }))
    await waitFor(() => expect(screen.getByText('visitor notes list')).toBeInTheDocument())
  })

  it('appends an optimistic message immediately on send', async () => {
    search = 'c=c1'
    render(<MessagesClient myId="me" />)
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Type a message...'), { target: { value: 'hi there' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    expect(screen.getByText('hi there')).toBeInTheDocument()
  })

  it('keeps the text and marks the message failed when the send fails', async () => {
    search = 'c=c1'
    global.fetch = vi.fn(async (url: any, init?: any) => {
      const href = String(url)
      if (href.includes('/messages') && init?.method === 'POST') return { ok: false, status: 500 } as any
      if (href.includes('/messages')) return { ok: true, json: async () => ({ messages: [] }) } as any
      return { ok: true, json: async () => ({ conversations: [conversation] }) } as any
    }) as any

    render(<MessagesClient myId="me" />)
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Type a message...'), { target: { value: 'oops' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument())
  })
})
