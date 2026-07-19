import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CommunityHubView } from './CommunityHubView'
import { DEFAULT_HUB_CONFIG } from '@/lib/types/hub-config'

vi.mock('./CommunityFeed', () => ({ CommunityFeed: () => <div data-testid="feed" /> }))
vi.mock('./CommunitySidebar', () => ({ CommunitySidebar: () => <div data-testid="sidebar" /> }))

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

  it('widens the container for three columns', () => {
    const { container } = render(<CommunityHubView {...base} />)
    expect(container.querySelector('.max-w-7xl')).toBeTruthy()
  })
})
