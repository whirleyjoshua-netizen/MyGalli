import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { InteractionsTab } from './InteractionsTab'
import { SEEN_STORAGE_KEY } from './useElementSeen'

const inventory = {
  elements: [
    {
      key: 'd1:e1', elementId: 'e1', type: 'poll', title: 'Favorite NBA Player',
      pageId: 'd1', pageTitle: 'Homepage', sectionIndex: 1, source: 'page', published: true,
      responseCount: 143, todayCount: 18, lastResponseAt: new Date().toISOString(),
      unreadCount: 0, pendingCount: 0, engagement: 84, status: 'idle',
    },
    {
      key: 'd2:w1', elementId: 'w1', type: 'waitlist', title: 'Beta waitlist',
      pageId: 'd2', pageTitle: 'Product Hub', sectionIndex: 1, source: 'page', published: true,
      responseCount: 623, todayCount: 0, lastResponseAt: '2026-01-01T00:00:00.000Z',
      unreadCount: 0, pendingCount: 0, engagement: null, status: 'idle',
    },
  ],
  totals: { elements: 2, responses: 766, avgEngagement: 84, liveNow: 1 },
  truncated: false,
}

const mockFetch = (body: unknown = inventory) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => body })

beforeEach(() => {
  localStorage.clear()
  // The waitlist element's response is old (2026-01-01); mark it seen after
  // that date so only the poll's brand-new response reads as needs-attention.
  // (deriveStatus flags ANY unseen response regardless of age — see
  // src/lib/element-os.ts — so without this seed both fixture elements would
  // be needs-attention on a first-ever load, which the brief's fixture did
  // not account for.)
  localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify({ 'd2:w1': '2026-01-02T00:00:00.000Z' }))
  vi.stubGlobal('fetch', mockFetch())
})
afterEach(() => vi.unstubAllGlobals())

describe('InteractionsTab', () => {
  it('shows skeletons before data arrives', () => {
    render(<InteractionsTab />)
    expect(screen.getByTestId('element-grid-skeleton')).toBeTruthy()
  })

  it('renders grouped cards once loaded', async () => {
    render(<InteractionsTab />)
    await waitFor(() => expect(screen.getByText('Favorite NBA Player')).toBeTruthy())
    // "Polls"/"Wait lists" also appear as FilterRail type chips, so scope to
    // the TypeGroup section heading to keep the query unambiguous.
    expect(screen.getByRole('heading', { name: 'Polls' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Wait lists' })).toBeTruthy()
  })

  it('finalises status on the client so a fresh response reads as needing attention', async () => {
    render(<InteractionsTab />)
    await waitFor(() => expect(screen.getByText('NEEDS YOU')).toBeTruthy())
  })

  it('derives the Need Attention total on the client', async () => {
    render(<InteractionsTab />)
    // "Need Attention" also labels a FilterRail checkbox, so assert presence
    // via getAllByText and disambiguate the strip itself by its button role.
    await waitFor(() => expect(screen.getAllByText('Need Attention').length).toBeGreaterThan(0))
    const strip = screen.getByRole('button', { name: /need attention/i })
    expect(strip.textContent).toContain('1')
  })

  it('filters by search', async () => {
    render(<InteractionsTab />)
    await waitFor(() => expect(screen.getByText('Favorite NBA Player')).toBeTruthy())
    fireEvent.change(screen.getByPlaceholderText(/search elements/i), { target: { value: 'beta' } })
    expect(screen.queryByText('Favorite NBA Player')).toBeNull()
    expect(screen.getByText('Beta waitlist')).toBeTruthy()
  })

  it('shows an empty state when the account has no data elements', async () => {
    vi.stubGlobal('fetch', mockFetch({ elements: [], totals: { elements: 0, responses: 0, avgEngagement: null, liveNow: 0 }, truncated: false }))
    render(<InteractionsTab />)
    await waitFor(() => expect(screen.getByText(/no interactive elements yet/i)).toBeTruthy())
  })

  it('shows an error state with a retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    render(<InteractionsTab />)
    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy())
  })

  it('warns when the inventory was truncated instead of hiding it', async () => {
    vi.stubGlobal('fetch', mockFetch({ ...inventory, truncated: true }))
    render(<InteractionsTab />)
    await waitFor(() => expect(screen.getByText(/showing the first 200 pages/i)).toBeTruthy())
  })

  it('keeps one pulse interval across ticks and clears it on unmount', async () => {
    vi.useFakeTimers()
    const setSpy = vi.spyOn(global, 'setInterval')
    const clearSpy = vi.spyOn(global, 'clearInterval')
    try {
      const { unmount } = render(<InteractionsTab />)
      // let the mocked fetch's promise chain (not a timer) settle before the
      // pulse effect mounts its interval
      await act(async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve()
      })
      const afterLoad = setSpy.mock.calls.length
      expect(afterLoad).toBeGreaterThan(0)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000)
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000)
      })
      // two ticks must not have mounted two more intervals
      expect(setSpy.mock.calls.length).toBe(afterLoad)
      unmount()
      expect(clearSpy).toHaveBeenCalled()
    } finally {
      setSpy.mockRestore()
      clearSpy.mockRestore()
      vi.useRealTimers()
    }
  })
})
