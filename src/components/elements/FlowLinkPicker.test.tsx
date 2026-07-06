// src/components/elements/FlowLinkPicker.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FlowLinkPicker } from './FlowLinkPicker'

vi.mock('@/lib/store', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { username: 'joe' } }) }))

const displays = [
  { id: 'd1', title: 'My Page', slug: 'my-page', kind: 'page' },
  { id: 'd2', title: 'My Board', slug: 'my-board', kind: 'collection' },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => displays }))
})
afterEach(() => vi.unstubAllGlobals())

describe('FlowLinkPicker', () => {
  it('picks a page → root-relative url and its title as label', async () => {
    const onPick = vi.fn()
    render(<FlowLinkPicker onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: /pages/i }))
    await waitFor(() => expect(screen.getByText('My Page')).toBeTruthy())
    fireEvent.click(screen.getByText('My Page'))
    expect(onPick).toHaveBeenCalledWith({ url: '/joe/my-page', label: 'My Page' })
  })

  it('picks a board from the boards group', async () => {
    const onPick = vi.fn()
    render(<FlowLinkPicker onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: /boards/i }))
    await waitFor(() => expect(screen.getByText('My Board')).toBeTruthy())
    fireEvent.click(screen.getByText('My Board'))
    expect(onPick).toHaveBeenCalledWith({ url: '/joe/my-board', label: 'My Board' })
  })

  it('external URL passes through safeHref; a bad scheme is rejected (no pick)', () => {
    const onPick = vi.fn()
    render(<FlowLinkPicker onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: /external/i }))
    const input = screen.getByPlaceholderText(/https/i)
    fireEvent.change(input, { target: { value: 'javascript:alert(1)' } })
    fireEvent.click(screen.getByRole('button', { name: /^set link$/i }))
    expect(onPick).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'https://ok.com' } })
    fireEvent.click(screen.getByRole('button', { name: /^set link$/i }))
    expect(onPick).toHaveBeenCalledWith({ url: 'https://ok.com', label: 'External link' })
  })

  it('None clears the link', () => {
    const onPick = vi.fn()
    render(<FlowLinkPicker value={{ url: '/joe/x', label: 'X' }} onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: /^none$/i }))
    expect(onPick).toHaveBeenCalledWith({ url: undefined, label: undefined })
  })
})
