import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PublicPollElement } from './PublicPollElement'
import * as analytics from '@/lib/analytics'

describe('poll interaction tracking', () => {
  beforeEach(() => {
    vi.spyOn(analytics, 'trackInteraction').mockResolvedValue()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ options: [], totalVotes: 0 }),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('records an interact event when a vote succeeds', async () => {
    const element = {
      id: 'el_1',
      type: 'poll',
      pollQuestion: 'Best frog?',
      pollOptions: ['Green'],
    }
    render(<PublicPollElement element={element as never} displayId="disp_1" />)

    fireEvent.click(await screen.findByText('Green'))
    fireEvent.click(screen.getByText('Vote'))

    await waitFor(() =>
      expect(analytics.trackInteraction).toHaveBeenCalledWith('disp_1', 'el_1', 'poll', 'vote')
    )
  })
})
