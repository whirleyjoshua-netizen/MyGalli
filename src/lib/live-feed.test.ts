import { describe, it, expect } from 'vitest'
import { applyLiveAction, IDLE_STATE } from './live-feed'

const NOW = '2026-07-06T00:00:00.000Z'

describe('applyLiveAction', () => {
  it('start sets isLive and stamps startedAt once', () => {
    const s1 = applyLiveAction(IDLE_STATE, { action: 'start' }, NOW)
    expect(s1.isLive).toBe(true)
    expect(s1.startedAt).toBe(NOW)
    const s2 = applyLiveAction(s1, { action: 'start' }, '2026-07-06T01:00:00.000Z')
    expect(s2.startedAt).toBe(NOW) // not overwritten
  })

  it('end clears isLive but keeps values', () => {
    const live = { isLive: true, valueA: 5, valueB: 3, startedAt: NOW }
    expect(applyLiveAction(live, { action: 'end' }, NOW)).toEqual({ ...live, isLive: false })
  })

  it('bump adjusts the chosen side and clamps at 0', () => {
    let s = applyLiveAction(IDLE_STATE, { action: 'bump', side: 'A', delta: 3 }, NOW)
    expect(s.valueA).toBe(3)
    s = applyLiveAction(s, { action: 'bump', side: 'B', delta: 2 }, NOW)
    expect(s.valueB).toBe(2)
    s = applyLiveAction(s, { action: 'bump', side: 'A', delta: -10 }, NOW)
    expect(s.valueA).toBe(0) // clamped
  })

  it('bump defaults to side A', () => {
    const s = applyLiveAction(IDLE_STATE, { action: 'bump', delta: 1 }, NOW)
    expect(s.valueA).toBe(1)
  })

  it('set overrides given sides, clamps and floors', () => {
    const s = applyLiveAction(IDLE_STATE, { action: 'set', valueA: 42.9, valueB: -5 }, NOW)
    expect(s.valueA).toBe(42)
    expect(s.valueB).toBe(0)
  })

  it('set caps at MAX_VALUE and ignores non-finite', () => {
    const s = applyLiveAction(IDLE_STATE, { action: 'set', valueA: 5_000_000_000 }, NOW)
    expect(s.valueA).toBe(1_000_000_000)
    const s2 = applyLiveAction({ isLive: false, valueA: 7, valueB: 0, startedAt: null }, { action: 'set', valueA: NaN }, NOW)
    expect(s2.valueA).toBe(7) // unchanged
  })

  it('bump ignores non-finite delta', () => {
    const s = applyLiveAction({ isLive: false, valueA: 3, valueB: 0, startedAt: null }, { action: 'bump', delta: NaN as unknown as number }, NOW)
    expect(s.valueA).toBe(3)
  })

  it('reset zeroes everything and ends', () => {
    const live = { isLive: true, valueA: 9, valueB: 4, startedAt: NOW }
    expect(applyLiveAction(live, { action: 'reset' }, NOW)).toEqual(IDLE_STATE)
  })
})
