import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AnalyticsPage from './page'

// Mutable so a single test can start the page on a different tab — the mock is
// module-level and cannot otherwise vary per test.
let searchParamsValue = 'tab=audience'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}))

const audience = {
  summary: {
    visitors: 412, sessions: 587, newVisitors: 255, returningVisitors: 157,
    avgSessionSeconds: 154, bounceRate: 43.2, measuredSessions: 300,
  },
  identityFallback: false,
  hourCountsUtc: Array.from({ length: 24 }, (_, h) => (h === 18 ? 40 : 1)),
  geography: [{ country: 'US', count: 62 }],
  unknownCountryEvents: 0,
  sources: [{ source: 'search', count: 30 }],
  devices: { desktop: 2 },
  browsers: { chrome: 2 },
}

describe('Data page Audience tab', () => {
  beforeEach(() => {
    searchParamsValue = 'tab=audience'
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.startsWith('/api/displays')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'd1', title: 'My Page', slug: 'my-page', views: 1 }]) })
      }
      if (url.includes('/audience')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(audience) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the audience panels when the tab is active', async () => {
    render(<AnalyticsPage />)
    await waitFor(() => expect(screen.getByText('412')).toBeTruthy())
    expect(screen.getByText('Peak Hours')).toBeTruthy()
    expect(screen.getByText('Geography')).toBeTruthy()
    expect(screen.getByText('Traffic Sources')).toBeTruthy()
  })

  it('offers exactly the built tabs and no placeholders for future phases', async () => {
    render(<AnalyticsPage />)
    await waitFor(() => expect(screen.getByText('Overview')).toBeTruthy())
    expect(screen.getByText('Audience')).toBeTruthy()
    for (const notYet of ['Interactions', 'Insights', 'Automation']) {
      expect(screen.queryByRole('button', { name: notYet })).toBeNull()
    }
  })

  it('does not request audience data while another tab is active', async () => {
    // Start on Overview, not Audience, so the lazy fetch must not have fired.
    searchParamsValue = ''
    vi.unstubAllGlobals()
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith('/api/displays')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'd1', title: 'My Page', slug: 'my-page', views: 1 }]) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AnalyticsPage />)
    await waitFor(() => expect(screen.getByText('Audience')).toBeTruthy())
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/audience'))).toBe(false)

    // Opening the tab does trigger it — proving the assertion above was not
    // passing merely because the fetch never happens at all.
    fireEvent.click(screen.getByText('Audience'))
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/audience'))).toBe(true)
    })
  })
})
