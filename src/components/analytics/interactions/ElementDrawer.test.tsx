import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ElementDrawer } from './ElementDrawer'
import type { ElementSummary } from '@/lib/element-os'

const el: ElementSummary = {
  key: 'd1:e1', elementId: 'e1', type: 'poll', title: 'Favorite NBA Player',
  pageId: 'd1', pageTitle: 'Homepage', sectionIndex: 1, source: 'page', published: true,
  responseCount: 2, todayCount: 1, lastResponseAt: new Date().toISOString(),
  unreadCount: 0, pendingCount: 0, engagement: 84, status: 'live',
}

const payload = {
  element: { elementId: 'e1', type: 'poll', title: 'Favorite NBA Player' },
  responses: [
    { answer: 'LeBron', submittedAt: '2026-07-20T10:00:00.000Z' },
    { answer: 'MJ', submittedAt: '2026-07-19T10:00:00.000Z' },
  ],
  series: [{ date: '2026-07-20', count: 1 }],
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }))
})
afterEach(() => vi.unstubAllGlobals())

describe('ElementDrawer', () => {
  it('renders nothing when no element is selected', () => {
    const { container } = render(<ElementDrawer element={null} tab="responses" onTabChange={() => {}} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the element header and fetched responses', async () => {
    render(<ElementDrawer element={el} tab="responses" onTabChange={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Favorite NBA Player')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('LeBron')).toBeTruthy())
  })

  it('fetches the composite path for a page element', async () => {
    render(<ElementDrawer element={el} tab="responses" onTabChange={() => {}} onClose={() => {}} />)
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/data/elements/d1/e1')
    )
  })

  it('switches to the analytics tab', () => {
    const onTabChange = vi.fn()
    render(<ElementDrawer element={el} tab="responses" onTabChange={onTabChange} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /analytics/i }))
    expect(onTabChange).toHaveBeenCalledWith('analytics')
  })

  it('closes on the close button and on Escape', () => {
    const onClose = vi.fn()
    render(<ElementDrawer element={el} tab="responses" onTabChange={() => {}} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('uses the bulletin analytics source for bulletin instruments', async () => {
    render(
      <ElementDrawer
        element={{ ...el, key: 'bulletin:p1:e1', source: 'bulletin', pageId: 'p1' }}
        tab="responses"
        onTabChange={() => {}}
        onClose={() => {}}
      />
    )
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/bulletin/analytics'))
  })

  it('says so when the response list is truncated', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...payload, responsesTruncated: true, responseCount: 431 }),
    }))
    render(<ElementDrawer element={el} tab="responses" onTabChange={() => {}} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('Showing the most recent 200 of 431 responses.')).toBeTruthy())
  })

  it('maps the bulletin payload into responses with the responder name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        posts: [
          { id: 'p1', createdAt: '2026-07-12T00:00:00.000Z', text: null,
            results: { elementId: 'e1', type: 'poll', question: 'Best?', options: ['A'], allowMultiple: false,
              totalVoters: 1, distribution: [{ option: 'A', count: 1, percentage: 100 }],
              respondents: [{ user: { userId: 'u1', name: 'Amy', avatar: null }, answer: ['A'] }] } },
        ],
      }),
    }))
    render(
      <ElementDrawer
        element={{ ...el, key: 'bulletin:p1:e1', source: 'bulletin', pageId: 'p1' }}
        tab="responses" onTabChange={() => {}} onClose={() => {}}
      />
    )
    await waitFor(() => expect(screen.getByText('Amy')).toBeTruthy())
    expect(screen.queryByText(/invalid date/i)).toBeNull()
  })

  it('renders object-valued answers as named fields, never [object Object]', async () => {
    // The real shape stored by PublicRSVPElement.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        element: { elementId: 'e1', type: 'rsvp', title: 'Party' },
        responses: [
          {
            answer: { name: 'Ada', attending: true, guests: 2, items: ['Chips', 'Ice'], note: 'See you!' },
            submittedAt: '2026-07-20T10:00:00.000Z',
          },
        ],
        series: [], responseCount: 1, responsesTruncated: false, windowDays: 30,
      }),
    }))
    render(
      <ElementDrawer element={{ ...el, type: 'rsvp' }} tab="responses" onTabChange={() => {}} onClose={() => {}} />
    )
    await waitFor(() => expect(screen.getByText('Ada')).toBeTruthy())
    expect(screen.getByText('Yes')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('Chips, Ice')).toBeTruthy()
    expect(screen.getByText('See you!')).toBeTruthy()
    expect(screen.queryByText(/\[object Object\]/)).toBeNull()
    expect(document.body.textContent).not.toContain('[object Object]')
  })

  it('keeps string and array answers rendering as before', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...payload,
        responses: [{ answer: ['A', 'B'], submittedAt: '2026-07-20T10:00:00.000Z' }],
      }),
    }))
    render(<ElementDrawer element={el} tab="responses" onTabChange={() => {}} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('A, B')).toBeTruthy())
  })

  it('shows an Approve control on a pending comment and PATCHes the moderation endpoint', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return Promise.resolve({ ok: true, json: async () => ({}) })
      return Promise.resolve({
        ok: true,
        json: async () => ({
          element: { elementId: 'e1', type: 'comment', title: 'Wall' },
          responses: [
            { id: 'c1', answer: 'nice work', who: 'Kim', approved: false, submittedAt: '2026-07-20T10:00:00.000Z' },
            { id: 'c2', answer: 'thanks', who: 'Lee', approved: true, submittedAt: '2026-07-19T10:00:00.000Z' },
          ],
          series: [], responseCount: 2, responsesTruncated: false, windowDays: 30,
        }),
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ElementDrawer element={{ ...el, type: 'comment' }} tab="responses" onTabChange={() => {}} onClose={() => {}} />
    )
    await waitFor(() => expect(screen.getByText('nice work')).toBeTruthy())

    // Only the pending one is actionable.
    const approveButtons = screen.getAllByRole('button', { name: /approve/i })
    expect(approveButtons).toHaveLength(1)
    expect(screen.getByText('Pending')).toBeTruthy()

    fireEvent.click(approveButtons[0])

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/displays/d1/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: 'c1', approved: true }),
      })
    )
    // The list updates in place — no reload.
    await waitFor(() => expect(screen.queryByRole('button', { name: /approve/i })).toBeNull())
    expect(screen.getByText('nice work')).toBeTruthy()
  })

  it('offers a CSV export link for a waitlist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        element: { elementId: 'e1', type: 'waitlist', title: 'List' },
        responses: [{ answer: 'a@b.com', who: 'Ada', submittedAt: '2026-07-20T10:00:00.000Z' }],
        series: [], responseCount: 1, responsesTruncated: false, windowDays: 30,
      }),
    }))
    render(
      <ElementDrawer element={{ ...el, type: 'waitlist' }} tab="responses" onTabChange={() => {}} onClose={() => {}} />
    )
    const link = await screen.findByRole('link', { name: /export csv/i })
    expect(link.getAttribute('href')).toBe('/api/waitlist/d1/e1/export')
  })

  it('refuses to show another element’s respondents when the bulletin results do not match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        posts: [
          { id: 'p1', createdAt: '2026-07-12T00:00:00.000Z', text: null,
            // The post's blocks[0] is a DIFFERENT element — this payload is the
            // poll's, not the rating's.
            results: { elementId: 'other-block', type: 'poll', question: 'Best?', options: ['A'],
              totalVoters: 1, distribution: [{ option: 'A', count: 1, percentage: 100 }],
              respondents: [{ user: { userId: 'u1', name: 'Amy', avatar: null }, answer: ['A'] }] } },
        ],
      }),
    }))
    render(
      <ElementDrawer
        element={{ ...el, key: 'bulletin:p1:e1', source: 'bulletin', pageId: 'p1' }}
        tab="responses" onTabChange={() => {}} onClose={() => {}}
      />
    )
    await waitFor(() => expect(screen.getByText(/aren’t available/i)).toBeTruthy())
    expect(screen.queryByText('Amy')).toBeNull()
    expect(screen.queryByText('No responses yet.')).toBeNull()
  })

  it('says responses are unavailable when the post is missing from the bulletin payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ posts: [] }) }))
    render(
      <ElementDrawer
        element={{ ...el, key: 'bulletin:p1:e1', source: 'bulletin', pageId: 'p1' }}
        tab="responses" onTabChange={() => {}} onClose={() => {}}
      />
    )
    await waitFor(() => expect(screen.getByText(/aren’t available/i)).toBeTruthy())
  })

  it('scopes the empty state to the window it actually queried', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...payload, responses: [], windowDays: 30 }),
    }))
    render(<ElementDrawer element={el} tab="responses" onTabChange={() => {}} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('No responses in the last 30 days.')).toBeTruthy())
  })

  it('explains that per-day activity is unavailable for bulletin instruments', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ posts: [] }) }))
    render(
      <ElementDrawer
        element={{ ...el, key: 'bulletin:p1:e1', source: 'bulletin', pageId: 'p1' }}
        tab="analytics" onTabChange={() => {}} onClose={() => {}}
      />
    )
    await waitFor(() =>
      expect(screen.getByText("Per-day activity isn't available for bulletin instruments.")).toBeTruthy()
    )
  })
})
