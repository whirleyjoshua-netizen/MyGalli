import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileNav } from './MobileNav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ user: { username: 'josh', name: 'Josh' }, logout: vi.fn() }),
}))
vi.mock('@/components/dashboard/ProfileCard', () => ({ ProfileCard: () => <div data-testid="profile-card" /> }))

describe('MobileNav', () => {
  beforeEach(() => { document.body.style.overflow = '' })

  it('renders a top bar with a menu button and a Create link, drawer closed initially', () => {
    render(<MobileNav />)
    expect(screen.getByLabelText('Open menu')).toBeTruthy()
    expect(screen.getByRole('link', { name: /create/i })).toBeTruthy()
    expect(screen.queryByText('Analytics')).toBeNull()
  })

  it('opens the drawer on menu click, showing all nav destinations + profile', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    for (const label of ['Home', 'My Pages', 'Collaborations', 'Explore', 'Analytics', 'Library', 'Create New']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('includes the mobile-only Bulletin entry linking to /bulletin', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    const link = screen.getByRole('link', { name: /bulletin/i })
    expect(link).toHaveAttribute('href', '/bulletin')
  })

  it('closes the drawer when a nav link is tapped', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    fireEvent.click(screen.getByText('Explore'))
    expect(screen.queryByText('Analytics')).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })
})
