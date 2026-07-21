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
})
