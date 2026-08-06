import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { IframeCardRenderer } from './IframeCardRenderer'

// The card iframe is server-rendered, so on a real public page the browser
// begins loading it during HTML parse and its `gallio:ready` broadcast can fire
// before React hydrates and attaches the message listener. That message is then
// gone for good, and the 10s load timeout used to show "This card failed to
// load" on a card that was working perfectly — every visitor, every time.
//
// These tests pin the recovery: the parent drives the handshake itself rather
// than depending on catching a broadcast it may have missed.
describe('IframeCardRenderer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // jsdom has no ResizeObserver; the component observes its wrapper to track
    // container width.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const renderCard = () =>
    render(<IframeCardRenderer url="/sdk/vouch-card.html" data={{}} style="default" />)

  it('posts init without waiting to be told the card is ready', () => {
    const { container } = renderCard()
    const iframe = container.querySelector('iframe') as HTMLIFrameElement
    const post = vi.fn()
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, writable: true })

    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(post).toHaveBeenCalled()
    expect(post.mock.calls[0][0]).toMatchObject({ type: 'gallio:init' })
  })

  it('keeps retrying init until the card answers', () => {
    const { container } = renderCard()
    const iframe = container.querySelector('iframe') as HTMLIFrameElement
    const post = vi.fn()
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, writable: true })

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Several attempts, not a single fire-and-forget.
    expect(post.mock.calls.length).toBeGreaterThan(1)
  })

  it('does not show the failure state when a height reply proves the card is alive', () => {
    const { container } = renderCard()
    const iframe = container.querySelector('iframe') as HTMLIFrameElement
    const fakeWindow = { postMessage: vi.fn() }
    Object.defineProperty(iframe, 'contentWindow', { value: fakeWindow, writable: true })

    // A height reply arrives, but the `gallio:ready` broadcast was missed —
    // exactly the hydration race. The card must still be treated as alive.
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'gallio:height', height: 120 }, source: fakeWindow as unknown as Window })
      )
    })

    act(() => {
      vi.advanceTimersByTime(15000)
    })

    expect(screen.queryByText('This card failed to load')).toBeNull()
    expect(container.querySelector('iframe')).not.toBeNull()
  })

  it('still reports failure when the card never answers at all', () => {
    const { container } = renderCard()
    const iframe = container.querySelector('iframe') as HTMLIFrameElement
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, writable: true })

    act(() => {
      vi.advanceTimersByTime(15000)
    })

    expect(screen.getByText('This card failed to load')).toBeTruthy()
  })
})
