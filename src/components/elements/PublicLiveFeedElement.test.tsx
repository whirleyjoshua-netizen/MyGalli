import { it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PublicLiveFeedElement } from './PublicLiveFeedElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: 'el-1', type: 'live-feed', liveFeedPreset: 'single', ...over } as CanvasElement)
const feed = (values: any[], over: any = {}) => ({ isLive: true, values, startedAt: null, clock: { mode: 'off', running: false, elapsedMs: 0, lastStartedAt: null, durationMs: null }, serverTime: '2026-07-25T00:00:00.000Z', lastUpdatedAt: null, ...over })

function stubFetch(payload: any) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload })) as any)
}
beforeEach(() => {
  // jsdom exposes `document.visibilityState` as an inherited getter-only accessor
  // (no setter), so a plain `Object.assign` throws in strict mode. Redefine it as
  // an own data property instead — it's `configurable`, so this is safe.
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})
afterEach(() => vi.restoreAllMocks())

it('leaderboard ranks entries by value descending', async () => {
  stubFetch(feed([{ id: 'a', label: 'Chiefs', value: 17 }, { id: 'b', label: 'Ravens', value: 21 }]))
  render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'leaderboard' })} />)
  await waitFor(() => expect(screen.getByText('Ravens')).toBeInTheDocument())
  const rows = screen.getAllByTestId('lf-rank')
  expect(rows[0]).toHaveTextContent('Ravens')  // 21 first
  expect(rows[1]).toHaveTextContent('Chiefs')
})

it('poll shows proportional percentages', async () => {
  stubFetch(feed([{ id: 'a', label: 'Pizza', value: 3 }, { id: 'b', label: 'Tacos', value: 1 }]))
  render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'poll', liveFeedPollReveal: 'always' })} />)
  await waitFor(() => expect(screen.getByText(/75%/)).toBeInTheDocument())
  expect(screen.getByText(/25%/)).toBeInTheDocument()
})

it('after-vote hides tallies until voted', async () => {
  stubFetch(feed([{ id: 'a', label: 'Pizza', value: 3 }]))
  render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'poll', liveFeedPollReveal: 'after-vote' })} />)
  await waitFor(() => expect(screen.getByRole('button', { name: /pizza/i })).toBeInTheDocument())
  expect(screen.queryByText(/100%/)).not.toBeInTheDocument()
})

it('renders a running clock', async () => {
  stubFetch(feed([{ id: 'a', label: '', value: 0 }], { clock: { mode: 'countup', running: true, elapsedMs: 65000, lastStartedAt: '2026-07-25T00:00:00.000Z', durationMs: null } }))
  render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'single', liveFeedClock: 'countup' })} />)
  await waitFor(() => expect(screen.getByRole('time')).toBeInTheDocument())
})

it('does not render the clock when element.liveFeedClock is off, even if runtime clock state is running', async () => {
  stubFetch(feed([{ id: 'a', label: '', value: 0 }], { clock: { mode: 'countup', running: true, elapsedMs: 65000, lastStartedAt: '2026-07-25T00:00:00.000Z', durationMs: null } }))
  render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'single', liveFeedClock: 'off' })} />)
  await waitFor(() => expect(screen.getByText('0')).toBeInTheDocument())
  expect(screen.queryByRole('time')).not.toBeInTheDocument()
})

it('a failed vote (non-ok response) leaves the option buttons live for retry', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/vote')) {
        return { ok: false, json: async () => ({}) }
      }
      return { ok: true, json: async () => feed([{ id: 'a', label: 'Pizza', value: 3 }]) }
    }) as any
  )
  render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'poll', liveFeedPollReveal: 'after-vote' })} />)
  const button = await screen.findByRole('button', { name: /pizza/i })
  button.click()
  await waitFor(() => expect(screen.queryByText(/vote failed/i)).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /pizza/i })).toBeInTheDocument()
  expect(localStorage.getItem('lf_voted_el-1')).toBeNull()
})

it('a rejected vote fetch leaves the option buttons live for retry', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/vote')) {
        throw new Error('network down')
      }
      return { ok: true, json: async () => feed([{ id: 'a', label: 'Pizza', value: 3 }]) }
    }) as any
  )
  render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'poll', liveFeedPollReveal: 'after-vote' })} />)
  const button = await screen.findByRole('button', { name: /pizza/i })
  button.click()
  await waitFor(() => expect(screen.queryByText(/vote failed/i)).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /pizza/i })).toBeInTheDocument()
  expect(localStorage.getItem('lf_voted_el-1')).toBeNull()
})
