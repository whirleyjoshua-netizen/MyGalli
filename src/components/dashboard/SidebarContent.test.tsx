import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SidebarContent } from './SidebarContent'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { username: 'josh', name: 'Josh' }, logout: vi.fn() }),
}))
vi.mock('@/components/dashboard/ProfileCard', () => ({ ProfileCard: () => <div data-testid="profile-card" /> }))

describe('SidebarContent', () => {
  it('desktop rail (no `mobile`) does NOT include the Bulletin entry', () => {
    render(<SidebarContent />)
    expect(screen.queryByRole('link', { name: /bulletin/i })).toBeNull()
    // sanity: the shared nav is present
    expect(screen.getByText('Explore')).toBeTruthy()
  })

  it('mobile drawer includes a Bulletin entry linking to /bulletin', () => {
    render(<SidebarContent mobile />)
    const link = screen.getByRole('link', { name: /bulletin/i })
    expect(link).toHaveAttribute('href', '/bulletin')
  })
})
