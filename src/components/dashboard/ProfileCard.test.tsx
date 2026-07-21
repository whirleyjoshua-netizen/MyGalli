import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileCard } from './ProfileCard'

const logout = vi.fn()
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { username: 'josh', name: 'Josh', avatar: null, bio: 'hi' }, logout }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response)))
})

describe('ProfileCard', () => {
  it('opens the followers list when the Followers stat is clicked', async () => {
    render(<ProfileCard />)
    const tile = screen.getByRole('button', { name: /followers/i })
    fireEvent.click(tile)
    // The modal fetches the follower list for the signed-in user.
    await vi.waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/users/josh/followers')
    )
  })

  it('opens the account menu with View profile, Settings, and Log out', () => {
    render(<ProfileCard />)
    fireEvent.click(screen.getByLabelText('Account menu'))
    expect(screen.getByRole('link', { name: /view profile/i })).toHaveAttribute('href', '/josh')
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
  })
  it('logs out via the store when Log out is clicked', () => {
    render(<ProfileCard />)
    fireEvent.click(screen.getByLabelText('Account menu'))
    fireEvent.click(screen.getByRole('button', { name: /log out/i }))
    expect(logout).toHaveBeenCalled()
  })
  it('collapsed variant hides the @handle/stats but still opens the menu', () => {
    render(<ProfileCard collapsed />)
    expect(screen.queryByText('@josh')).toBeNull()
    expect(screen.queryByText('Followers')).toBeNull()
    fireEvent.click(screen.getByLabelText('Account menu'))
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })
})
