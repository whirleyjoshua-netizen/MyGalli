import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { LiveActivityFeed, LIVE_POLL_MS } from './LiveActivityFeed'

const items = [
  { id: '1', label: 'Someone from Germany opened your page', country: 'DE', at: new Date().toISOString() },
  { id: '2', label: 'Someone followed you', country: null, at: new Date(Date.now() - 60_000).toISOString() },
]

describe('LiveActivityFeed', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders each activity label', () => {
    render(<LiveActivityFeed items={items} onRefresh={vi.fn()} />)
    expect(screen.getByText('Someone from Germany opened your page')).toBeTruthy()
    expect(screen.getByText('Someone followed you')).toBeTruthy()
  })

  it('shows an illustrated empty state when there is no activity', () => {
    render(<LiveActivityFeed items={[]} onRefresh={vi.fn()} />)
    expect(screen.getByText(/No activity yet/i)).toBeTruthy()
  })

  it('polls on an interval while the tab is visible', () => {
    const onRefresh = vi.fn()
    render(<LiveActivityFeed items={items} onRefresh={onRefresh} />)
    act(() => { vi.advanceTimersByTime(LIVE_POLL_MS * 2) })
    expect(onRefresh).toHaveBeenCalledTimes(2)
  })

  it('does not poll while the tab is hidden', () => {
    const onRefresh = vi.fn()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    render(<LiveActivityFeed items={items} onRefresh={onRefresh} />)
    act(() => { vi.advanceTimersByTime(LIVE_POLL_MS * 3) })
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('keeps ticking while hidden and resumes polling once visible again', () => {
    const onRefresh = vi.fn()
    const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    render(<LiveActivityFeed items={items} onRefresh={onRefresh} />)
    act(() => { vi.advanceTimersByTime(LIVE_POLL_MS * 3) })
    expect(onRefresh).not.toHaveBeenCalled()

    visibilitySpy.mockReturnValue('visible')
    act(() => { vi.advanceTimersByTime(LIVE_POLL_MS) })
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('stops polling after unmount', () => {
    const onRefresh = vi.fn()
    const { unmount } = render(<LiveActivityFeed items={items} onRefresh={onRefresh} />)
    unmount()
    act(() => { vi.advanceTimersByTime(LIVE_POLL_MS * 3) })
    expect(onRefresh).not.toHaveBeenCalled()
  })
})
