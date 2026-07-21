import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ElementCard } from './ElementCard'
import type { ElementSummary } from '@/lib/element-os'

const el = (over: Partial<ElementSummary> = {}): ElementSummary => ({
  key: 'd1:e1',
  elementId: 'e1',
  type: 'poll',
  title: 'Favorite NBA Player',
  pageId: 'd1',
  pageTitle: 'Homepage',
  sectionIndex: 2,
  source: 'page',
  published: true,
  responseCount: 143,
  todayCount: 18,
  lastResponseAt: new Date().toISOString(),
  unreadCount: 0,
  pendingCount: 0,
  engagement: 84,
  status: 'live',
  ...over,
})

describe('ElementCard', () => {
  it('renders the title, counts and engagement', () => {
    render(<ElementCard element={el()} onOpen={() => {}} editHref="/editor/d1" />)
    expect(screen.getByText('Favorite NBA Player')).toBeTruthy()
    expect(screen.getByText('143')).toBeTruthy()
    expect(screen.getByText('84%')).toBeTruthy()
  })

  it('renders the location as page and 1-based section, since sections have no names', () => {
    render(<ElementCard element={el()} onOpen={() => {}} editHref="/editor/d1" />)
    expect(screen.getByText('Homepage · Section 2')).toBeTruthy()
  })

  it('includes the tab label in the location for tabbed pages', () => {
    render(<ElementCard element={el({ tabLabel: 'Reviews' })} onOpen={() => {}} editHref="/editor/d1" />)
    expect(screen.getByText('Homepage · Reviews · Section 2')).toBeTruthy()
  })

  it('shows a Bulletin chip instead of a page location for bulletin instruments', () => {
    render(<ElementCard element={el({ source: 'bulletin', pageTitle: 'Bulletin' })} onOpen={() => {}} editHref="/bulletin" />)
    expect(screen.getByText('Bulletin')).toBeTruthy()
  })

  it('shows a LIVE pill only when live', () => {
    const { rerender } = render(<ElementCard element={el()} onOpen={() => {}} editHref="/e" />)
    expect(screen.getByText('LIVE')).toBeTruthy()
    rerender(<ElementCard element={el({ status: 'idle' })} onOpen={() => {}} editHref="/e" />)
    expect(screen.queryByText('LIVE')).toBeNull()
  })

  it('shows a dash for engagement when there is too little data', () => {
    render(<ElementCard element={el({ engagement: null })} onOpen={() => {}} editHref="/e" />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('opens the drawer on Responses and on Analytics', () => {
    const onOpen = vi.fn()
    render(<ElementCard element={el()} onOpen={onOpen} editHref="/e" />)
    fireEvent.click(screen.getByRole('button', { name: /responses/i }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: 'd1:e1' }), 'responses')
    fireEvent.click(screen.getByRole('button', { name: /analytics/i }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: 'd1:e1' }), 'analytics')
  })

  it('links Edit to the owning page', () => {
    render(<ElementCard element={el()} onOpen={() => {}} editHref="/editor/d1" />)
    expect(screen.getByRole('link', { name: /edit/i }).getAttribute('href')).toBe('/editor/d1')
  })

  it('renders an unread badge for mailboxes', () => {
    render(<ElementCard element={el({ type: 'mailbox', unreadCount: 4, status: 'needs-attention' })} onOpen={() => {}} editHref="/e" />)
    expect(screen.getByText('4 unread')).toBeTruthy()
  })

  it('renders a waitlist capacity line', () => {
    render(<ElementCard element={el({ type: 'waitlist', responseCount: 623 })} onOpen={() => {}} editHref="/e" />)
    expect(screen.getByText('623 joined')).toBeTruthy()
  })

  it('says so when nothing has been collected yet', () => {
    render(<ElementCard element={el({ responseCount: 0, lastResponseAt: null, status: 'idle' })} onOpen={() => {}} editHref="/e" />)
    expect(screen.getByText(/no responses yet/i)).toBeTruthy()
  })
})
