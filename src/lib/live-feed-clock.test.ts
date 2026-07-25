import { describe, it, expect, vi } from 'vitest'
import { computeDisplayMs, formatClock } from './live-feed-clock'

const base = { mode: 'countup' as const, running: false, elapsedMs: 0, lastStartedAt: null, durationMs: null }

describe('computeDisplayMs', () => {
  it('off mode is always 0', () => {
    expect(computeDisplayMs({ ...base, mode: 'off' }, '2026-07-25T00:00:00.000Z', 5000)).toBe(0)
  })

  it('paused countup returns accumulated elapsed, ignoring the monotonic delta', () => {
    expect(computeDisplayMs({ ...base, elapsedMs: 42000, running: false }, '2026-07-25T00:00:00.000Z', 9999)).toBe(42000)
  })

  it('running countup adds the server segment plus the monotonic delta', () => {
    const clock = { ...base, running: true, elapsedMs: 10000, lastStartedAt: '2026-07-25T00:00:00.000Z' }
    // server was 3s past lastStartedAt at poll; client has advanced 2s more since receipt
    expect(computeDisplayMs(clock, '2026-07-25T00:00:03.000Z', 2000)).toBe(10000 + 3000 + 2000)
  })

  it('is independent of any wall-clock skew (only server-provided values + a monotonic delta)', () => {
    const clock = { ...base, running: true, elapsedMs: 0, lastStartedAt: '2026-07-25T00:00:00.000Z' }
    // same inputs regardless of what Date.now() is on the device
    expect(computeDisplayMs(clock, '2026-07-25T00:00:05.000Z', 0)).toBe(5000)

    try {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'))
      const resultA = computeDisplayMs(clock, '2026-07-25T00:00:05.000Z', 0)

      vi.setSystemTime(new Date('2099-06-15T12:34:56.789Z'))
      const resultB = computeDisplayMs(clock, '2026-07-25T00:00:05.000Z', 0)

      expect(resultA).toBe(5000)
      expect(resultB).toBe(5000)
      expect(resultA).toBe(resultB)
    } finally {
      vi.useRealTimers()
    }
  })

  it('coerces a non-finite durationMs to 0 instead of returning NaN (countdown, running)', () => {
    const clock = {
      mode: 'countdown' as const,
      running: true,
      elapsedMs: 0,
      lastStartedAt: '2026-07-25T00:00:00.000Z',
      durationMs: NaN,
    }
    const result = computeDisplayMs(clock, '2026-07-25T00:00:02.000Z', 0)
    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBe(0)
  })

  it('countdown counts down from duration and floors at 0', () => {
    const clock = { mode: 'countdown' as const, running: true, elapsedMs: 0, lastStartedAt: '2026-07-25T00:00:00.000Z', durationMs: 6000 }
    expect(computeDisplayMs(clock, '2026-07-25T00:00:02.000Z', 0)).toBe(4000)
    expect(computeDisplayMs(clock, '2026-07-25T00:00:10.000Z', 0)).toBe(0) // floored
  })

  it('never returns a negative monotonic contribution', () => {
    const clock = { ...base, running: true, elapsedMs: 1000, lastStartedAt: '2026-07-25T00:00:00.000Z' }
    expect(computeDisplayMs(clock, '2026-07-25T00:00:00.000Z', -500)).toBe(1000)
  })
})

describe('formatClock', () => {
  it('formats M:SS under an hour', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(59000)).toBe('0:59')
    expect(formatClock(60000)).toBe('1:00')
    expect(formatClock(725000)).toBe('12:05')
  })
  it('formats H:MM:SS at or over an hour', () => {
    expect(formatClock(3600000)).toBe('1:00:00')
    expect(formatClock(3661000)).toBe('1:01:01')
  })
  it('treats non-finite input as 0 instead of emitting NaN:NaN', () => {
    expect(formatClock(NaN)).toBe('0:00')
    expect(formatClock(Infinity)).toBe('0:00')
  })
})
