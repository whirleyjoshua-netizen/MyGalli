import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileFieldsPanel } from './ProfileFieldsPanel'
import type { User } from '@/lib/types'

vi.mock('@/lib/store', () => ({
  useAuthStore: (sel: (s: { setAuth: () => void }) => unknown) => sel({ setAuth: vi.fn() }),
}))

const user: User = {
  id: 'u1', email: 'a@b.co', username: 'josh', name: 'Josh',
  location: 'NYC', bio: 'hi', interests: [], links: [],
} as User

describe('ProfileFieldsPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'Josh R' }) }) as unknown as Response,
    ) as unknown as typeof fetch
  })
  afterEach(() => vi.useRealTimers())

  it('renders the name field with the initial value', () => {
    render(<ProfileFieldsPanel user={user} onSavingChange={() => {}} />)
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Josh')
  })

  it('debounced-saves to /api/profile after editing a field', () => {
    render(<ProfileFieldsPanel user={user} onSavingChange={() => {}} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Josh R' } })
    expect(global.fetch).not.toHaveBeenCalled() // debounced, not immediate
    vi.advanceTimersByTime(900)
    expect(global.fetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'PATCH' }))
  })
})
