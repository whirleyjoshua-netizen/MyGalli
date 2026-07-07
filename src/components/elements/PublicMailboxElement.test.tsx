import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PublicMailboxElement } from './PublicMailboxElement'
import type { CanvasElement } from '@/lib/types/canvas'

function el(over: Partial<CanvasElement> = {}): CanvasElement {
  return { id: 'el-mb', type: 'mailbox', mailboxTitle: 'Msg me', mailboxPrompt: 'say hi', mailboxButtonLabel: 'Send', mailboxThankYou: 'Thanks!', displayId: 'd1', ...over } as CanvasElement
}

beforeEach(() => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ ok: true }) })) })
afterEach(() => vi.unstubAllGlobals())

describe('PublicMailboxElement', () => {
  it('renders the prompt and a hidden honeypot', () => {
    const { container } = render(<PublicMailboxElement element={el()} />)
    expect(screen.getByText('say hi')).toBeTruthy()
    const hp = container.querySelector('input[name="hp"]') as HTMLInputElement
    expect(hp).toBeTruthy()
    expect(hp.tabIndex).toBe(-1)
  })

  it('submits a text message and shows the thank-you', async () => {
    render(<PublicMailboxElement element={el()} />)
    fireEvent.change(screen.getByPlaceholderText(/message/i), { target: { value: 'hello there' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => expect(screen.getByText('Thanks!')).toBeTruthy())
    const call = (fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/api/messages'))
    expect(call).toBeTruthy()
    expect(JSON.parse(call[1].body)).toMatchObject({ displayId: 'd1', elementId: 'el-mb', kind: 'text', body: 'hello there' })
  })

  it('blocks submit when the message is empty', () => {
    render(<PublicMailboxElement element={el()} />)
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    const called = (fetch as any).mock.calls.some((c: any[]) => String(c[0]).includes('/api/messages'))
    expect(called).toBe(false)
  })
})
