export interface ValueEntry { id: string; label: string; value: number; color?: string }
export interface LiveClock {
  mode: 'off' | 'countup' | 'countdown'
  running: boolean
  elapsedMs: number
  lastStartedAt: string | null
  durationMs: number | null
}
export interface LiveFeedState {
  isLive: boolean
  values: ValueEntry[]
  startedAt: string | null
  clock: LiveClock
}

export type LiveAction =
  | { action: 'start' } | { action: 'end' } | { action: 'reset' }
  | { action: 'addValue'; id: string; label: string }
  | { action: 'removeValue'; id: string }
  | { action: 'renameValue'; id: string; label: string }
  | { action: 'bump'; id: string; delta: number }
  | { action: 'set'; id: string; value: number }
  | { action: 'clockConfig'; mode: 'off' | 'countup' | 'countdown'; durationMs?: number }
  | { action: 'clockStart' } | { action: 'clockPause' }
  | { action: 'clockSet'; elapsedMs: number } | { action: 'clockReset' }

const OFF_CLOCK: LiveClock = { mode: 'off', running: false, elapsedMs: 0, lastStartedAt: null, durationMs: null }
export const IDLE_STATE: LiveFeedState = { isLive: false, values: [], startedAt: null, clock: OFF_CLOCK }

const MAX_VALUE = 1_000_000_000
const clamp = (n: number) => (Number.isFinite(n) ? Math.min(MAX_VALUE, Math.max(0, Math.floor(n))) : 0)
const mapValue = (s: LiveFeedState, id: string, fn: (v: ValueEntry) => ValueEntry): LiveFeedState => {
  let found = false
  const values = s.values.map((v) => (v.id === id ? ((found = true), fn(v)) : v))
  return found ? { ...s, values } : s
}

export function applyLiveAction(state: LiveFeedState, action: LiveAction, now: string): LiveFeedState {
  const c = state.clock
  switch (action.action) {
    case 'start': return { ...state, isLive: true, startedAt: state.startedAt ?? now }
    case 'end': return { ...state, isLive: false }
    case 'reset': return { ...IDLE_STATE }
    case 'addValue': return { ...state, values: [...state.values, { id: action.id, label: action.label, value: 0 }] }
    case 'removeValue': return { ...state, values: state.values.filter((v) => v.id !== action.id) }
    case 'renameValue': return mapValue(state, action.id, (v) => ({ ...v, label: action.label }))
    case 'bump':
      if (!Number.isFinite(action.delta)) return state
      return mapValue(state, action.id, (v) => ({ ...v, value: clamp(v.value + action.delta) }))
    case 'set':
      if (!Number.isFinite(action.value)) return state
      return mapValue(state, action.id, (v) => ({ ...v, value: clamp(action.value) }))
    case 'clockConfig':
      if (action.mode === 'off') return { ...state, clock: { ...OFF_CLOCK } }
      return { ...state, clock: { ...c, mode: action.mode, durationMs: action.durationMs ?? c.durationMs ?? null } }
    case 'clockStart':
      return c.running ? state : { ...state, clock: { ...c, running: true, lastStartedAt: now } }
    case 'clockPause': {
      if (!c.running || !c.lastStartedAt) return state
      const seg = Math.max(0, Date.parse(now) - Date.parse(c.lastStartedAt))
      return { ...state, clock: { ...c, running: false, lastStartedAt: null, elapsedMs: Math.max(0, c.elapsedMs + seg) } }
    }
    case 'clockSet':
      return { ...state, clock: { ...c, elapsedMs: Math.max(0, Math.floor(action.elapsedMs) || 0), lastStartedAt: c.running ? now : c.lastStartedAt } }
    case 'clockReset':
      return { ...state, clock: { ...c, running: false, elapsedMs: 0, lastStartedAt: null } }
    default: return state
  }
}
