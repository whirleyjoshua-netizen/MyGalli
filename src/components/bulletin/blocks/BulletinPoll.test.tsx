import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BulletinPoll } from './BulletinPoll'
import type { CanvasElement } from '@/lib/types/canvas'

const block: CanvasElement = { id: 'blk-1', type: 'poll', pollQuestion: 'Coffee or tea?', pollOptions: ['Coffee', 'Tea'] }

describe('BulletinPoll', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('submits an identified poll response for the selected option', async () => {
    const results = { elementId: 'blk-1', type: 'poll', question: 'Coffee or tea?', options: ['Coffee', 'Tea'], allowMultiple: false, totalVoters: 1, distribution: [{ option: 'Coffee', count: 1, percentage: 100 }, { option: 'Tea', count: 0, percentage: 0 }], respondents: [] }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results, myResponse: {} }) })
    vi.stubGlobal('fetch', fetchMock)
    const onResults = vi.fn()

    render(<BulletinPoll postId="p1" block={block} results={null} myResponse={null} onResults={onResults} />)

    fireEvent.click(screen.getByRole('button', { name: 'Coffee' }))
    fireEvent.click(screen.getByRole('button', { name: /vote/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/bulletin/p1/respond',
      expect.objectContaining({ method: 'POST' })
    ))
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.responses['blk-1']).toMatchObject({ type: 'poll', answer: ['Coffee'] })
    await waitFor(() => expect(onResults).toHaveBeenCalledWith(results))
  })

  it('shows results (percentages) when results are already visible', () => {
    const results = { elementId: 'blk-1', type: 'poll', question: 'Coffee or tea?', options: ['Coffee', 'Tea'], allowMultiple: false, totalVoters: 4, distribution: [{ option: 'Coffee', count: 3, percentage: 75 }, { option: 'Tea', count: 1, percentage: 25 }], respondents: [] }
    render(<BulletinPoll postId="p1" block={block} results={results as any} myResponse={{ 'blk-1': { type: 'poll', answer: ['Coffee'] } }} onResults={() => {}} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })
})
