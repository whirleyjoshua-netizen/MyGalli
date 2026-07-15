import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GalliTopBar } from './GalliTopBar'

const mockUser = vi.hoisted(() => ({ current: null as null | { username: string; name: string | null; avatar: string | null } }))
vi.mock('@/lib/store', () => ({ useAuthStore: () => ({ user: mockUser.current }) }))

describe('GalliTopBar', () => {
  it('sends Home to /dashboard and shows the avatar when logged in', () => {
    mockUser.current = { username: 'josh', name: 'Josh', avatar: null }
    render(<GalliTopBar />)
    expect(screen.getByLabelText('Home')).toHaveAttribute('href', '/dashboard')
    expect(screen.getByLabelText('Your profile')).toHaveAttribute('href', '/josh')
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('sends Home to / and shows the login control when logged out', () => {
    mockUser.current = null
    render(<GalliTopBar />)
    expect(screen.getByLabelText('Home')).toHaveAttribute('href', '/')
    expect(screen.getByLabelText('Log in')).toHaveAttribute('href', '/login')
    expect(screen.queryByLabelText('Your profile')).not.toBeInTheDocument()
  })

  it('renders the search slot when provided', () => {
    mockUser.current = null
    render(<GalliTopBar search={<input aria-label="Slotted search" />} />)
    expect(screen.getByLabelText('Slotted search')).toBeInTheDocument()
  })

  it('omits the sub-bar when no children are given', () => {
    mockUser.current = null
    render(<GalliTopBar />)
    expect(screen.queryByTestId('subbar')).not.toBeInTheDocument()
  })

  it('renders children in the sub-bar', () => {
    mockUser.current = null
    render(<GalliTopBar><span>Chips here</span></GalliTopBar>)
    expect(screen.getByTestId('subbar')).toBeInTheDocument()
    expect(screen.getByText('Chips here')).toBeInTheDocument()
  })

  it('always renders the brand wordmark', () => {
    mockUser.current = null
    render(<GalliTopBar />)
    expect(screen.getByText('My Galli')).toBeInTheDocument()
  })

  // jsdom does no layout, so the Tailwind class is the only observable for
  // stickiness — and a header that doesn't stick is the feature failing.
  it('pins itself to the top of the viewport', () => {
    mockUser.current = null
    const { container } = render(<GalliTopBar />)
    expect(container.querySelector('.sticky.top-0.z-20')).toBeInTheDocument()
  })

  // Same rationale as the sticky test. These pin the two tones the product
  // deliberately chose — Explore's frosted Anchor and the profile's white —
  // and guard against a drift back to the retired gradient.
  describe('tone', () => {
    it('defaults to the frosted Anchor glass, not the retired gradient', () => {
      mockUser.current = null
      const { container } = render(<GalliTopBar />)
      expect(container.querySelector('.bg-galli-dark\\/70.backdrop-blur-md')).toBeInTheDocument()
      expect(container.querySelector('[class*="from-galli"]')).not.toBeInTheDocument()
    })

    it('blends into a light page when tone is light', () => {
      mockUser.current = null
      const { container } = render(<GalliTopBar tone="light" />)
      expect(container.querySelector('.bg-surface\\/80.backdrop-blur-md')).toBeInTheDocument()
      expect(container.querySelector('.bg-galli-dark\\/70')).not.toBeInTheDocument()
    })

    it('darkens its contents for the light tone so they stay visible', () => {
      mockUser.current = null
      const { container } = render(<GalliTopBar tone="light" />)
      // The wordmark must not stay white-on-white.
      expect(screen.getByText('My Galli')).toHaveClass('text-galli-dark')
      expect(container.querySelector('.text-white')).not.toBeInTheDocument()
    })
  })
})
