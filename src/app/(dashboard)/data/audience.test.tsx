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

  it('offers exactly the built tabs (Overview, Audience, Interactions) and no placeholders for future phases', async () => {
    render(<AnalyticsPage />)
    await waitFor(() => expect(screen.getByText('Overview')).toBeTruthy())
    expect(screen.getByRole('button', { name: /Audience/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Interactions/ })).toBeTruthy()
    for (const notYet of ['Insights', 'Automation']) {
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

  it('does not show the previous display\'s numbers after switching display, before the new response resolves', async () => {
    const audienceTwo = {
      ...audience,
      summary: { ...audience.summary, visitors: 999 },
    }

    // Deferred promise for display d2's audience response, so we control
    // exactly when it resolves and can assert during the gap.
    let resolveSecond: (value: unknown) => void = () => {}
    const secondResponse = new Promise((resolve) => { resolveSecond = resolve })

    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.startsWith('/api/displays')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'd1', title: 'My Page', slug: 'my-page', views: 1 },
            { id: 'd2', title: 'Other Page', slug: 'other-page', views: 1 },
          ]),
        })
      }
      if (url.includes('/d1/audience')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(audience) })
      }
      if (url.includes('/d2/audience')) {
        return secondResponse.then((data) => ({ ok: true, json: () => Promise.resolve(data) }))
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }))

    render(<AnalyticsPage />)
    await waitFor(() => expect(screen.getByText('412')).toBeTruthy())

    const select = screen.getByDisplayValue('My Page') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'd2' } })

    // While d2's request is still in flight, the old display's number must
    // be gone (either loading state, or simply not "412" anymore).
    await waitFor(() => {
      expect(screen.queryByText('412')).toBeNull()
    })

    resolveSecond(audienceTwo)
    await waitFor(() => expect(screen.getByText('999')).toBeTruthy())
  })
})
