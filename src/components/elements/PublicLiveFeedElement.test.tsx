import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PublicLiveFeedElement } from './PublicLiveFeedElement'
import type { CanvasElement } from '@/lib/types/canvas'

function el(overrides: Partial<CanvasElement>): CanvasElement {
  return { id: 'el-1', type: 'live-feed', ...overrides } as CanvasElement
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ isLive: true, valueA: 7, valueB: 2, startedAt: null, lastUpdatedAt: null }),
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('PublicLiveFeedElement', () => {
  it('single preset shows the value and title', async () => {
    render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'single', liveFeedTitle: 'Push-ups', liveFeedLabelA: 'Reps' })} />)
    await waitFor(() => expect(screen.getByText('7')).toBeTruthy())
    expect(screen.getByText('Push-ups')).toBeTruthy()
    expect(screen.getByText(/LIVE/i)).toBeTruthy() // isLive badge
  })

  it('versus preset shows both values and labels', async () => {
    render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'versus', liveFeedLabelA: 'HOME', liveFeedLabelB: 'AWAY' })} />)
    await waitFor(() => expect(screen.getByText('7')).toBeTruthy())
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('HOME')).toBeTruthy()
    expect(screen.getByText('AWAY')).toBeTruthy()
  })

  it('goal preset shows value toward target', async () => {
    render(<PublicLiveFeedElement element={el({ liveFeedPreset: 'goal', liveFeedTarget: 10, liveFeedTitle: 'Goal' })} />)
    await waitFor(() => expect(screen.getByText('7')).toBeTruthy())
    expect(screen.getByText(/10/)).toBeTruthy() // target shown somewhere
  })
})
