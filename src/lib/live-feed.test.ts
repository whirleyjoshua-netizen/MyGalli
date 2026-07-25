import { describe, it, expect } from 'vitest'
import { applyLiveAction, IDLE_STATE, type LiveFeedState } from './live-feed'

const NOW = '2026-07-25T00:00:00.000Z'
const entry = (id: string, value = 0, label = '') => ({ id, label, value })
const withValues = (...v: ReturnType<typeof entry>[]): LiveFeedState => ({ ...IDLE_STATE, values: v })

describe('lifecycle', () => {
  it('start sets isLive and stamps startedAt once', () => {
    const s1 = applyLiveAction(IDLE_STATE, { action: 'start' }, NOW)
    expect(s1.isLive).toBe(true)
    expect(s1.startedAt).toBe(NOW)
    const s2 = applyLiveAction(s1, { action: 'start' }, '2026-07-25T01:00:00.000Z')
    expect(s2.startedAt).toBe(NOW)
  })
  it('reset returns idle', () => {
    const dirty: LiveFeedState = { isLive: true, values: [entry('a', 9)], startedAt: NOW, clock: { mode: 'countup', running: true, elapsedMs: 5, lastStartedAt: NOW, durationMs: null } }
    expect(applyLiveAction(dirty, { action: 'reset' }, NOW)).toEqual(IDLE_STATE)
  })
})

describe('value actions (id-addressed)', () => {
  it('addValue appends an entry with the given id and label', () => {
    const s = applyLiveAction(IDLE_STATE, { action: 'addValue', id: 'x', label: 'Ravens' }, NOW)
    expect(s.values).toEqual([entry('x', 0, 'Ravens')])
  })
  it('bump changes only the addressed entry and clamps at 0', () => {
    let s = withValues(entry('a', 0, 'A'), entry('b', 0, 'B'))
    s = applyLiveAction(s, { action: 'bump', id: 'a', delta: 3 }, NOW)
    expect(s.values.find(v => v.id === 'a')!.value).toBe(3)
    expect(s.values.find(v => v.id === 'b')!.value).toBe(0)
    s = applyLiveAction(s, { action: 'bump', id: 'a', delta: -10 }, NOW)
    expect(s.values.find(v => v.id === 'a')!.value).toBe(0)
  })
  it('bump/set on a missing id is a no-op', () => {
    const s = withValues(entry('a', 5))
    expect(applyLiveAction(s, { action: 'bump', id: 'zzz', delta: 1 }, NOW)).toEqual(s)
    expect(applyLiveAction(s, { action: 'set', id: 'zzz', value: 9 }, NOW)).toEqual(s)
  })
  it('set replaces the value exactly (clamped)', () => {
    const s = applyLiveAction(withValues(entry('a', 5)), { action: 'set', id: 'a', value: 42 }, NOW)
    expect(s.values[0].value).toBe(42)
  })
  it('renameValue changes only the label; removeValue drops it', () => {
    let s = withValues(entry('a', 1, 'x'), entry('b', 2, 'y'))
    s = applyLiveAction(s, { action: 'renameValue', id: 'a', label: 'Home' }, NOW)
    expect(s.values[0]).toEqual(entry('a', 1, 'Home'))
    s = applyLiveAction(s, { action: 'removeValue', id: 'b' }, NOW)
    expect(s.values.map(v => v.id)).toEqual(['a'])
  })
  it('does not mutate the input', () => {
    const s = withValues(entry('a', 0))
    applyLiveAction(s, { action: 'bump', id: 'a', delta: 1 }, NOW)
    expect(s.values[0].value).toBe(0)
  })
})

describe('clock actions', () => {
  const T0 = '2026-07-25T00:00:00.000Z'
  const T5 = '2026-07-25T00:00:05.000Z'
  it('clockConfig sets mode and duration; off zeroes and stops', () => {
    let s = applyLiveAction(IDLE_STATE, { action: 'clockConfig', mode: 'countdown', durationMs: 6000 }, T0)
    expect(s.clock).toMatchObject({ mode: 'countdown', durationMs: 6000 })
    s = applyLiveAction({ ...s, clock: { ...s.clock, running: true, elapsedMs: 3000, lastStartedAt: T0 } }, { action: 'clockConfig', mode: 'off' }, T5)
    expect(s.clock).toEqual({ mode: 'off', running: false, elapsedMs: 0, lastStartedAt: null, durationMs: null })
  })
  it('clockStart marks running and anchors lastStartedAt; no-op if already running', () => {
    let s = applyLiveAction(IDLE_STATE, { action: 'clockStart' }, T0)
    expect(s.clock).toMatchObject({ running: true, lastStartedAt: T0 })
    const s2 = applyLiveAction(s, { action: 'clockStart' }, T5)
    expect(s2.clock.lastStartedAt).toBe(T0)
  })
  it('clockPause folds the running segment into elapsedMs using now', () => {
    const running = { ...IDLE_STATE, clock: { mode: 'countup' as const, running: true, elapsedMs: 1000, lastStartedAt: T0, durationMs: null } }
    const s = applyLiveAction(running, { action: 'clockPause' }, T5)
    expect(s.clock).toMatchObject({ running: false, lastStartedAt: null, elapsedMs: 1000 + 5000 })
  })
  it('clockSet sets elapsed and re-anchors when running', () => {
    const running = { ...IDLE_STATE, clock: { mode: 'countup' as const, running: true, elapsedMs: 1000, lastStartedAt: T0, durationMs: null } }
    const s = applyLiveAction(running, { action: 'clockSet', elapsedMs: 30000 }, T5)
    expect(s.clock).toMatchObject({ elapsedMs: 30000, lastStartedAt: T5 })
  })
  it('clockReset zeroes and stops', () => {
    const running = { ...IDLE_STATE, clock: { mode: 'countup' as const, running: true, elapsedMs: 1000, lastStartedAt: T0, durationMs: null } }
    expect(applyLiveAction(running, { action: 'clockReset' }, T5).clock).toMatchObject({ running: false, elapsedMs: 0, lastStartedAt: null })
  })
})
