import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommunityHubView } from './CommunityHubView'
import { DEFAULT_HUB_CONFIG } from '@/lib/types/hub-config'

vi.mock('./CommunityFeed', () => ({ CommunityFeed: () => <div data-testid="feed" /> }))
vi.mock('./CommunitySidebar', () => ({ CommunitySidebar: () => <div data-testid="sidebar" /> }))

// The view reads the active tab from the URL, so it needs a router context.
const replace = vi.fn()
let currentSearch = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(currentSearch),
  usePathname: () => '/o/hub/h',
}))

beforeEach(() => {
  replace.mockClear()
  currentSearch = ''
})

const base = {
  hub: { id: 'h1', title: 'Hub', tagline: null, description: null, coverImage: null, heroVideoUrl: null },
  ownerUsername: 'o', isPrivileged: false, joined: false, memberCount: 0,
  members: [], resources: [], events: [], drops: [], notes: [],
  counts: { posts: 0, members: 0, resources: 0, events: 0, kollab: 0 },
  sharePath: '/o/hub/h', config: DEFAULT_HUB_CONFIG, preview: true,
}

describe('CommunityHubView layout', () => {
  it('uses three columns when the pool is enabled', () => {
    const { container } = render(<CommunityHubView {...base} />)
    expect(container.querySelector('.lg\\:grid-cols-\\[260px_1fr_320px\\]')).toBeTruthy()
  })

  // An empty 260px rail would otherwise sit there when the pool is off.
  it('falls back to two columns when the pool is disabled', () => {
    const config = { ...DEFAULT_HUB_CONFIG, kollab: { ...DEFAULT_HUB_CONFIG.kollab, enabled: false } }
    const { container } = render(<CommunityHubView {...base} config={config} />)
    expect(container.querySelector('.lg\\:grid-cols-\\[260px_1fr_320px\\]')).toBeNull()
    expect(container.querySelector('.lg\\:grid-cols-\\[1fr_320px\\]')).toBeTruthy()
  })

  it('fills the viewport width rather than centring in a fixed column', () => {
    const { container } = render(<CommunityHubView {...base} />)
    // Full-bleed: gutters only, no max-width cap that would leave dead space
    // on either side of the three-column layout on a wide screen.
    expect(container.querySelector('.w-full.px-4')).toBeTruthy()
    expect(container.querySelector('.max-w-7xl')).toBeNull()
  })
})

const withFiles = {
  ...base,
  fileFolders: [{ id: 'f1', parentId: null, name: 'Decks', order: 0, locked: false }],
  fileItems: [{ id: 'i1', folderId: null, type: 'file', title: 'Root Readme', url: 'https://x/1', order: 0, locked: false }],
}

describe('CommunityHubView tabs', () => {
  it('renders a real tab bar, not a decorative label', () => {
    render(<CommunityHubView {...withFiles} />)
    expect(screen.getByRole('tab', { name: /home/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /files/i })).toBeInTheDocument()
  })

  it('puts the tab in the URL when Files is chosen', () => {
    render(<CommunityHubView {...withFiles} />)
    fireEvent.click(screen.getByRole('tab', { name: /files/i }))
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('tab=files'), expect.anything())
  })

  it('shows the Home body and no file list by default', () => {
    render(<CommunityHubView {...withFiles} />)
    expect(screen.getByTestId('feed')).toBeInTheDocument()
    expect(screen.queryByText('Root Readme')).not.toBeInTheDocument()
  })

  it('swaps the Home body for the file list when ?tab=files', () => {
    currentSearch = 'tab=files'
    render(<CommunityHubView {...withFiles} />)
    expect(screen.getByText('Root Readme')).toBeInTheDocument()
    expect(screen.queryByTestId('feed')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /files/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('does not offer file manage controls to a non-owner', () => {
    currentSearch = 'tab=files'
    render(<CommunityHubView {...withFiles} />)
    expect(screen.queryByRole('button', { name: /new folder/i })).not.toBeInTheDocument()
  })

  it('offers file manage controls to the owner', () => {
    currentSearch = 'tab=files'
    render(<CommunityHubView {...withFiles} isOwner />)
    expect(screen.getByRole('button', { name: /new folder/i })).toBeInTheDocument()
  })
})
