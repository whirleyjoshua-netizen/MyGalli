import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
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
    render(<MessagesClient myId="me" myUsername="mine" />)
    await waitFor(() => expect(screen.getByText('Sarah Johnson')).toBeInTheDocument())
  })

  it('puts the selected conversation in the URL', async () => {
    render(<MessagesClient myId="me" myUsername="mine" />)
    await waitFor(() => expect(screen.getByText('Sarah Johnson')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Sarah Johnson/ }))
    expect(push).toHaveBeenCalledWith('/messages?c=c1')
  })

  it('shows the visitor notes tab content when selected', async () => {
    render(<MessagesClient myId="me" myUsername="mine" />)
    fireEvent.click(screen.getByRole('button', { name: /Visitor notes/i }))
    await waitFor(() => expect(screen.getByText('visitor notes list')).toBeInTheDocument())
  })

  it('appends an optimistic message immediately on send', async () => {
    search = 'c=c1'
    render(<MessagesClient myId="me" myUsername="mine" />)
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

    render(<MessagesClient myId="me" myUsername="mine" />)
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Type a message...'), { target: { value: 'oops' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument())
    expect(screen.getByText('oops')).toBeInTheDocument()
  })

  it('does not duplicate a message the poll delivers while a send is in flight', async () => {
    search = 'c=c1'
    let resolvePost: (v: any) => void = () => {}
    const postPromise = new Promise((resolve) => {
      resolvePost = resolve
    })
    global.fetch = vi.fn(async (url: any, init?: any) => {
      const href = String(url)
      if (href.includes('/messages') && init?.method === 'POST') {
        return postPromise as any
      }
      if (href.includes('/messages')) {
        // The poll "wins the race": it reports the server message before the
        // POST response resolves.
        return {
          ok: true,
          json: async () => ({
            messages: [
              {
                id: 'server1', conversationId: 'c1', senderId: 'me', kind: 'text',
                body: 'hi there', mediaUrl: null, createdAt: new Date().toISOString(),
              },
            ],
          }),
        } as any
      }
      if (href.includes('/conversations')) {
        return { ok: true, json: async () => ({ conversations: [conversation] }) } as any
      }
      return { ok: true, json: async () => ({}) } as any
    }) as any

    render(<MessagesClient myId="me" myUsername="mine" />)
    await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Type a message...'), { target: { value: 'hi there' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))

    // Let the poll (triggered separately in the component's effects) deliver
    // the server copy of the message before the POST resolves.
    await waitFor(() => expect(screen.getAllByText('hi there').length).toBeGreaterThanOrEqual(1))

    resolvePost({
      ok: true,
      json: async () => ({
        message: {
          id: 'server1', conversationId: 'c1', senderId: 'me', kind: 'text',
          body: 'hi there', mediaUrl: null, createdAt: new Date().toISOString(),
        },
      }),
    })

    await waitFor(() => expect(screen.queryByText(/sending/i)).not.toBeInTheDocument())
    expect(screen.getAllByText('hi there')).toHaveLength(1)
  })

  it('discards a thread response for a conversation the user has switched away from', async () => {
    search = 'c=c1'
    let resolveFirst: (v: any) => void = () => {}
    const firstThread = new Promise((resolve) => {
      resolveFirst = resolve
    })
    let callCount = 0
    global.fetch = vi.fn(async (url: any, init?: any) => {
      const href = String(url)
      if (href.includes('/conversations/c1/messages') && init?.method !== 'POST' && !href.includes('/read')) {
        callCount += 1
        if (callCount === 1) return firstThread as any
        return { ok: true, json: async () => ({ messages: [] }) } as any
      }
      if (href.includes('/conversations/c2/messages') && !href.includes('/read')) {
        return { ok: true, json: async () => ({ messages: [] }) } as any
      }
      if (href.includes('/read')) {
        return { ok: true, json: async () => ({}) } as any
      }
      if (href.includes('/conversations')) {
        return {
          ok: true,
          json: async () => ({
            conversations: [
              conversation,
              { ...conversation, id: 'c2', other: { ...conversation.other, id: 'them2', username: 'jo', name: 'Jo Lee' } },
            ],
          }),
        } as any
      }
      return { ok: true, json: async () => ({}) } as any
    }) as any

    const { rerender } = render(<MessagesClient myId="me" myUsername="mine" />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())

    // Switch away from c1 to c2 before c1's in-flight thread fetch resolves.
    search = 'c=c2'
    rerender(<MessagesClient myId="me" myUsername="mine" />)
    await waitFor(() => expect(screen.getAllByText('Jo Lee').length).toBeGreaterThan(0))

    // Now let c1's stale response land.
    await act(async () => {
      resolveFirst({
        ok: true,
        json: async () => ({
          messages: [
            {
              id: 'stale1', conversationId: 'c1', senderId: 'them', kind: 'text',
              body: 'this belongs to c1', mediaUrl: null, createdAt: new Date().toISOString(),
            },
          ],
        }),
      })
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(screen.queryByText('this belongs to c1')).not.toBeInTheDocument()
  })

  describe('starting a conversation', () => {
    const withPicker = (onCreate: () => any) =>
      vi.fn(async (url: any, init?: any) => {
        const href = String(url)
        if (href.endsWith('/api/dm/conversations') && init?.method === 'POST') return onCreate() as any
        if (href.includes('/followers')) {
          return {
            ok: true,
            json: async () => ({ users: [{ username: 'sarah', name: 'Sarah Johnson', avatar: null }] }),
          } as any
        }
        if (href.includes('/following')) return { ok: true, json: async () => ({ users: [] }) } as any
        if (href.includes('/messages')) return { ok: true, json: async () => ({ messages: [] }) } as any
        return { ok: true, json: async () => ({ conversations: [] }) } as any
      }) as any

    it('creates the conversation and selects it when a person is picked', async () => {
      const created = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'cNew' }) }))
      global.fetch = withPicker(created)

      render(<MessagesClient myId="me" myUsername="mine" />)
      fireEvent.click(screen.getByRole('button', { name: /new message/i }))

      await waitFor(() => expect(screen.getByText('@sarah')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: /Sarah Johnson/ }))

      await waitFor(() => expect(created).toHaveBeenCalled())
      await waitFor(() => expect(push).toHaveBeenCalledWith('/messages?c=cNew'))
    })

    it('closes the picker after a successful start', async () => {
      global.fetch = withPicker(async () => ({ ok: true, json: async () => ({ id: 'cNew' }) }))

      render(<MessagesClient myId="me" myUsername="mine" />)
      fireEvent.click(screen.getByRole('button', { name: /new message/i }))
      await waitFor(() => expect(screen.getByText('@sarah')).toBeInTheDocument())
      fireEvent.click(screen.getByRole('button', { name: /Sarah Johnson/ }))

      await waitFor(() => expect(screen.queryByText('@sarah')).not.toBeInTheDocument())
    })
  })
})
