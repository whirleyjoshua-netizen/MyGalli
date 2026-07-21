import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ProfileDmModal } from './ProfileDmModal'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

beforeEach(() => {
  vi.clearAllMocks()
})

const type = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText(/write a message/i), { target: { value: text } })

describe('ProfileDmModal', () => {
  it('creates the conversation then posts the first message', async () => {
    const calls: string[] = []
    global.fetch = vi.fn(async (url: any, init?: any) => {
      const href = String(url)
      calls.push(`${init?.method} ${href}`)
      if (href.endsWith('/api/dm/conversations')) return { ok: true, json: async () => ({ id: 'cNew' }) } as any
      return { ok: true, json: async () => ({ message: {} }) } as any
    }) as any

    render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} />)
    type('hello there')
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() =>
      expect(calls).toEqual([
        'POST /api/dm/conversations',
        'POST /api/dm/conversations/cNew/messages',
      ])
    )
  })

  it('sends the typed body to the messages endpoint', async () => {
    let sentBody: any = null
    global.fetch = vi.fn(async (url: any, init?: any) => {
      const href = String(url)
      if (href.endsWith('/api/dm/conversations')) return { ok: true, json: async () => ({ id: 'cNew' }) } as any
      sentBody = JSON.parse(init.body)
      return { ok: true, json: async () => ({ message: {} }) } as any
    }) as any

    render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} />)
    type('hello there')
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(sentBody).toEqual({ body: 'hello there' }))
  })

  it('navigates to the new conversation after sending', async () => {
    global.fetch = vi.fn(async (url: any) => {
      const href = String(url)
      if (href.endsWith('/api/dm/conversations')) return { ok: true, json: async () => ({ id: 'cNew' }) } as any
      return { ok: true, json: async () => ({ message: {} }) } as any
    }) as any

    render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} />)
    type('hi')
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/messages?c=cNew'))
  })

  it('disables send until something is typed', () => {
    global.fetch = vi.fn() as any
    render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
    type('hi')
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled()
  })

  it('keeps the text and shows an error when the create fails', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} />)
    type('keep me')
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(screen.getByText(/could not send/i)).toBeInTheDocument())
    expect(screen.getByPlaceholderText(/write a message/i)).toHaveValue('keep me')
    expect(push).not.toHaveBeenCalled()
  })

  it('does not post a message when the conversation create fails', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }))
    global.fetch = fetchMock as any
    render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} />)
    type('nope')
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => expect(screen.getByText(/could not send/i)).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('closes when the close button is clicked', () => {
    global.fetch = vi.fn() as any
    const onClose = vi.fn()
    render(<ProfileDmModal username="sarah" name="Sarah" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  describe('when onSent is provided', () => {
    const okFetch = () =>
      vi.fn(async (url: any) => {
        const href = String(url)
        if (href.endsWith('/api/dm/conversations')) return { ok: true, json: async () => ({ id: 'cNew' }) } as any
        return { ok: true, json: async () => ({ message: {} }) } as any
      }) as any

    it('calls onSent instead of navigating away', async () => {
      global.fetch = okFetch()
      const onSent = vi.fn()
      render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} onSent={onSent} />)
      fireEvent.change(screen.getByPlaceholderText(/write a message/i), { target: { value: 'hi' } })
      fireEvent.click(screen.getByRole('button', { name: /send/i }))

      await waitFor(() => expect(onSent).toHaveBeenCalled())
      expect(push).not.toHaveBeenCalled()
    })

    it('still sends the message through both endpoints', async () => {
      const calls: string[] = []
      global.fetch = vi.fn(async (url: any) => {
        const href = String(url)
        calls.push(href)
        if (href.endsWith('/api/dm/conversations')) return { ok: true, json: async () => ({ id: 'cNew' }) } as any
        return { ok: true, json: async () => ({ message: {} }) } as any
      }) as any

      render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} onSent={vi.fn()} />)
      fireEvent.change(screen.getByPlaceholderText(/write a message/i), { target: { value: 'hi' } })
      fireEvent.click(screen.getByRole('button', { name: /send/i }))

      await waitFor(() =>
        expect(calls).toEqual(['/api/dm/conversations', '/api/dm/conversations/cNew/messages'])
      )
    })

    it('does not call onSent when the send fails', async () => {
      global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
      const onSent = vi.fn()
      render(<ProfileDmModal username="sarah" name="Sarah" onClose={vi.fn()} onSent={onSent} />)
      fireEvent.change(screen.getByPlaceholderText(/write a message/i), { target: { value: 'nope' } })
      fireEvent.click(screen.getByRole('button', { name: /send/i }))

      await waitFor(() => expect(screen.getByText(/could not send/i)).toBeInTheDocument())
      expect(onSent).not.toHaveBeenCalled()
    })
  })
})
