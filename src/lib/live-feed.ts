export interface LiveFeedState {
  isLive: boolean
  valueA: number
  valueB: number
  startedAt: string | null // ISO timestamp
}

export type LiveAction =
  | { action: 'start' }
  | { action: 'end' }
  | { action: 'reset' }
  | { action: 'bump'; side?: 'A' | 'B'; delta: number }
  | { action: 'set'; valueA?: number; valueB?: number }

export const IDLE_STATE: LiveFeedState = { isLive: false, valueA: 0, valueB: 0, startedAt: null }

const MAX_VALUE = 1_000_000_000

const clamp = (n: number) =>
  Number.isFinite(n) ? Math.min(MAX_VALUE, Math.max(0, Math.floor(n))) : 0

export function applyLiveAction(state: LiveFeedState, action: LiveAction, now: string): LiveFeedState {
  switch (action.action) {
    case 'start':
      return { ...state, isLive: true, startedAt: state.startedAt ?? now }
    case 'end':
      return { ...state, isLive: false }
    case 'reset':
      return { ...IDLE_STATE }
    case 'bump': {
      if (!Number.isFinite(action.delta)) return state
      const side = action.side ?? 'A'
      if (side === 'B') return { ...state, valueB: clamp(state.valueB + action.delta) }
      return { ...state, valueA: clamp(state.valueA + action.delta) }
    }
    case 'set':
      return {
        ...state,
        valueA: Number.isFinite(action.valueA as number) ? clamp(action.valueA as number) : state.valueA,
        valueB: Number.isFinite(action.valueB as number) ? clamp(action.valueB as number) : state.valueB,
      }
    default:
      return state
  }
}
