export type LiveFeedPreset = 'single' | 'versus' | 'goal'

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

const clamp = (n: number) => Math.max(0, Math.floor(n))

export function applyLiveAction(state: LiveFeedState, action: LiveAction, now: string): LiveFeedState {
  switch (action.action) {
    case 'start':
      return { ...state, isLive: true, startedAt: state.startedAt ?? now }
    case 'end':
      return { ...state, isLive: false }
    case 'reset':
      return { ...IDLE_STATE }
    case 'bump': {
      const side = action.side ?? 'A'
      if (side === 'B') return { ...state, valueB: clamp(state.valueB + action.delta) }
      return { ...state, valueA: clamp(state.valueA + action.delta) }
    }
    case 'set':
      return {
        ...state,
        valueA: action.valueA != null ? clamp(action.valueA) : state.valueA,
        valueB: action.valueB != null ? clamp(action.valueB) : state.valueB,
      }
    default:
      return state
  }
}
