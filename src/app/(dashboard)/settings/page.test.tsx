import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsPage from './page'

const setAuth = vi.fn()
vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { id: 'u1', username: 'josh', name: 'Josh', bio: 'hi', avatar: null, email: 'j@x.com' }, setAuth }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn((url: string) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(url === '/api/profile' ? { name: 'Josh R', bio: 'hi' } : {}) } as Response),
  ))
})

describe('SettingsPage', () => {
  it('pre-fills the form from the store user', () => {
    render(<SettingsPage />)
    expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe('Josh')
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('j@x.com')
  })
  it('saves edited name via PATCH /api/profile', async () => {
    render(<SettingsPage />)
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Josh R' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      const patch = calls.find((c) => c[0] === '/api/profile')
      expect(patch).toBeTruthy()
      expect(JSON.parse(patch![1].body)).toMatchObject({ name: 'Josh R' })
    })
    expect(setAuth).toHaveBeenCalled()
  })
})
