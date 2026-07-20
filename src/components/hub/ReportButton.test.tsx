import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReportButton } from './ReportButton'

beforeEach(() => {
  vi.restoreAllMocks()
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'r1' }) }) as any) as any
})

describe('ReportButton', () => {
  it('opens a reason picker and POSTs the chosen reason', async () => {
    render(<ReportButton hubId="h1" targetType="drop" targetId="d1" currentUserId="u2" authorId="u1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Report' }))
    fireEvent.click(screen.getByLabelText('Harassment'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/hubs/h1/reports', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ targetType: 'drop', targetId: 'd1', reason: 'harassment' }),
      }))
    })
  })

  it('shows a confirmation and does not re-post after success', async () => {
    render(<ReportButton hubId="h1" targetType="post" targetId="p1" currentUserId="u2" authorId="u1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Report' }))
    fireEvent.click(screen.getByLabelText('Spam'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText(/moderator will take a look/i)).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByText(/moderator will take a look/i)).toBeNull()
  })

  it('hides the report control from the content author', () => {
    render(<ReportButton hubId="h1" targetType="post" targetId="p1" currentUserId="u1" authorId="u1" />)
    expect(screen.queryByRole('button', { name: 'Report' })).toBeNull()
  })

  it('shows the control when no authorId/currentUserId are given', () => {
    render(<ReportButton hubId="h1" targetType="member" targetId="u9" />)
    expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument()
  })
})
