import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InsightsStrip } from './InsightsStrip'

const totals = { elements: 18, responses: 1483, avgEngagement: 73, needsAttention: 12, liveNow: 4 }

describe('InsightsStrip', () => {
  it('renders all five stats with formatted values', () => {
    render(<InsightsStrip totals={totals} onFilterStatus={() => {}} />)
    expect(screen.getByText('1,483')).toBeTruthy()
    expect(screen.getByText('73%')).toBeTruthy()
    for (const label of ['Elements', 'Responses', 'Avg. Engagement', 'Need Attention', 'Live Now']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('shows a dash when engagement has too little data to report', () => {
    render(<InsightsStrip totals={{ ...totals, avgEngagement: null }} onFilterStatus={() => {}} />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('filters to needs-attention when that stat is clicked', () => {
    const onFilterStatus = vi.fn()
    render(<InsightsStrip totals={totals} onFilterStatus={onFilterStatus} />)
    fireEvent.click(screen.getByRole('button', { name: /need attention/i }))
    expect(onFilterStatus).toHaveBeenCalledWith('needs-attention')
  })

  it('filters to live when that stat is clicked', () => {
    const onFilterStatus = vi.fn()
    render(<InsightsStrip totals={totals} onFilterStatus={onFilterStatus} />)
    fireEvent.click(screen.getByRole('button', { name: /live now/i }))
    expect(onFilterStatus).toHaveBeenCalledWith('live')
  })

  it('does not make the non-actionable stats clickable', () => {
    render(<InsightsStrip totals={totals} onFilterStatus={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})
