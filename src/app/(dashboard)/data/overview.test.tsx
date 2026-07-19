import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AnalyticsPage from './page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}))

const analytics = {
  display: { id: 'd1', title: 'My Page', totalViews: 1284 },
  period: { days: 30, start: '2026-06-19T00:00:00Z', end: '2026-07-19T00:00:00Z' },
  summary: { views: 1284, uniqueVisitors: 812, followers: 356, shares: 74, interactions: 1102 },
  previous: { views: 1086, uniqueVisitors: 707, followers: 326, shares: 66, interactions: 910 },
  health: { score: 92, band: 'excellent', drivers: [{ key: 'followers', label: 'Followers', delta: 30 }], insufficientData: false },
  liveActivity: [{ id: '1', label: 'Someone from Germany opened your page', country: 'DE', at: new Date().toISOString() }],
  widgetPerformance: [{ elementType: 'poll', label: 'Poll', stat: '53% of viewers voted', count: 53, trend: [1, 2, 3] }],
  sectionEngagement: [{ id: 's1', label: 'Landing Hero', count: 68 }],
  breakdown: { devices: {}, browsers: {}, referrers: [{ domain: 'instagram.com', count: 32 }] },
  viewsByDay: { '2026-07-18': 40, '2026-07-19': 60 },
  uniqueVisitorsByDay: { '2026-07-18': 20, '2026-07-19': 30 },
  topReferrerByDay: {},
  recentEvents: [],
}

describe('Data page Overview cockpit', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.startsWith('/api/displays')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'd1', title: 'My Page', slug: 'my-page', views: 1284 }]) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(analytics) })
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the five stat cards, health gauge and panels', async () => {
    render(<AnalyticsPage />)
    // 1,284 renders twice by design: the StatCardRow "Views" card and the
    // ReferrerDonut's totalViews center label share the same summary.views value.
    await waitFor(() => expect(screen.getAllByText('1,284').length).toBe(2))
    expect(screen.getByText('Interactions')).toBeTruthy()
    expect(screen.getByText('Page Health')).toBeTruthy()
    expect(screen.getByText('92')).toBeTruthy()
    expect(screen.getByText('Live Activity')).toBeTruthy()
    expect(screen.getByText('Landing Hero')).toBeTruthy()
    expect(screen.getByText('Quick Actions')).toBeTruthy()
  })

  it('no longer offers a Messages tab', async () => {
    render(<AnalyticsPage />)
    await waitFor(() => expect(screen.getByText('Overview')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Messages' })).toBeNull()
  })
})
