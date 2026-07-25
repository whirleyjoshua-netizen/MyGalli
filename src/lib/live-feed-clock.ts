// Pure clock math. Declares its input structurally so it does not import from
// live-feed.ts (avoids a cycle) but stays compatible with LiveClock.
interface ClockInput {
  mode: 'off' | 'countup' | 'countdown'
  running: boolean
  elapsedMs: number
  lastStartedAt: string | null
  durationMs: number | null
}

/**
 * Displayed clock time, in ms.
 *
 * `serverTime` is the ISO instant the poll response was generated; the segment
 * `serverTime − lastStartedAt` is computed entirely from server-provided values,
 * so the device wall clock never enters. `monotonicDeltaMs` is
 * `performance.now() − receivedAtPerf` — a monotonic delta that cannot jump if
 * the device clock changes. A paused clock adds nothing local and holds still.
 */
export function computeDisplayMs(clock: ClockInput, serverTime: string, monotonicDeltaMs: number): number {
  if (clock.mode === 'off') return 0
  const serverSegment =
    clock.running && clock.lastStartedAt
      ? Date.parse(serverTime) - Date.parse(clock.lastStartedAt)
      : 0
  const live = clock.elapsedMs + serverSegment + (clock.running ? Math.max(0, monotonicDeltaMs) : 0)
  const durationMs = typeof clock.durationMs === 'number' && Number.isFinite(clock.durationMs) ? clock.durationMs : 0
  const result = clock.mode === 'countdown' ? Math.max(0, durationMs - live) : Math.max(0, live)
  return Number.isFinite(result) ? result : 0
}

export function formatClock(ms: number): string {
  const safeMs = Number.isFinite(ms) ? ms : 0
  const total = Math.max(0, Math.floor(safeMs / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`
  return `${m}:${ss}`
}
