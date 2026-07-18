import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PublicWaitlistElement } from './PublicWaitlistElement'

const base = {
  id: 'w1', type: 'waitlist', waitlistTitle: 'Creator Academy',
  waitlistButtonLabel: 'Join Wait List', waitlistShowCount: true,
  waitlistConfirmationMessage: "You're on the list! 🎉", waitlistStyle: 'hero',
} as any

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string, opts?: any) => {
    if (String(url).includes('/count')) return { ok: true, json: async () => ({ count: 41 }) } as any
    return { ok: true, status: 201, json: async () => ({ count: 42 }) } as any // join
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('PublicWaitlistElement', () => {
  it('renders the title and the live count', async () => {
    render(<PublicWaitlistElement element={base} displayId="d1" />)
    expect(screen.getByText('Creator Academy')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/41/)).toBeInTheDocument())
  })

  it('shows the confirmation after a successful join', async () => {
    render(<PublicWaitlistElement element={base} displayId="d1" />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /join wait list/i }))
    await waitFor(() => expect(screen.getByText(/on the list/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /join wait list/i })).not.toBeInTheDocument()
  })

  it('renders the progress bar and disables joining when full', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ count: 100 }) })) as any)
    render(<PublicWaitlistElement element={{ ...base, waitlistStyle: 'progress', waitlistCapacity: 100 }} displayId="d1" />)
    await waitFor(() => expect(screen.getByText(/100 \/ 100/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /full/i })).toBeDisabled()
  })
})
