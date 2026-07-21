import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePolling } from './usePolling'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('usePolling', () => {
  it('does not fire before the first interval elapses', () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, { intervalMs: 5000 }))
    expect(fn).not.toHaveBeenCalled()
  })

  it('fires once per interval', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, { intervalMs: 5000 }))
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('does not poll when disabled', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, { intervalMs: 5000, enabled: false }))
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(fn).not.toHaveBeenCalled()
  })

  it('stops polling while the tab is hidden', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, { intervalMs: 5000 }))
    act(() => setHidden(true))
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(fn).not.toHaveBeenCalled()
    act(() => setHidden(false))
  })

  it('refetches immediately when the tab becomes visible again', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    renderHook(() => usePolling(fn, { intervalMs: 5000 }))
    act(() => setHidden(true))
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    fn.mockClear()
    act(() => setHidden(false))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('counts consecutive failures and resets on success', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => usePolling(fn, { intervalMs: 1000 }))
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(result.current.failures).toBeGreaterThanOrEqual(3)
    fn.mockResolvedValue(undefined)
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(result.current.failures).toBe(0)
  })
})
