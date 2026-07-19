import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LibraryAppsTab } from './LibraryAppsTab'

vi.mock('@/lib/store', () => ({ useAuthStore: () => ({ user: { id: 'me', plan: 'free' } }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('LibraryAppsTab', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })) as unknown as typeof fetch)
  })

  it('renders featured Vouch (with chips) and KollabShare (Coming soon)', () => {
    render(<LibraryAppsTab />)
    expect(screen.getByText('Featured')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vouch' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'KollabShare' })).toBeInTheDocument()
    expect(screen.getByText('Trusted')).toBeInTheDocument()
    expect(screen.getByText('Coming soon')).toBeInTheDocument() // KollabShare pill
  })

  it('shows the "More coming soon" panel and a disabled Request-an-App CTA', () => {
    render(<LibraryAppsTab />)
    expect(screen.getByText('More coming soon!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Request an App/i })).toBeDisabled()
  })

  it('filters out non-matching apps and hides static panels while searching', () => {
    render(<LibraryAppsTab query="zzz-nomatch" />)
    expect(screen.queryByRole('heading', { name: 'Vouch' })).not.toBeInTheDocument()
    expect(screen.getByText(/No apps match/i)).toBeInTheDocument()
    expect(screen.queryByText('More coming soon!')).not.toBeInTheDocument()
  })

  it('renders a decorative illustration svg for each featured app', () => {
    const { container } = render(<LibraryAppsTab />)
    expect(container.querySelectorAll('[aria-hidden="true"] svg').length).toBeGreaterThan(0)
  })
})
