import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChartInspector } from './ChartInspector'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'chart',
  chartType: 'bar', chartTitle: 'Chart Title',
  chartData: [{ label: 'A', value: 1 }],
  ...over,
} as CanvasElement)

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<ChartInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('ChartInspector', () => {
  it('sets chart type → chartType', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: /pie/i }))
    expect(onChange).toHaveBeenCalledWith({ chartType: 'pie' })
  })

  it('marks the active chart type', () => {
    setup({ chartType: 'line' })
    expect(screen.getByRole('button', { name: /line/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^bar$/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('edits the title → chartTitle', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Revenue' } })
    expect(onChange).toHaveBeenCalledWith({ chartTitle: 'Revenue' })
  })

  it.each([
    [/3d effect/i, 'chartEnable3D'],
    [/glow/i, 'chartEnableGlow'],
    [/gradient/i, 'chartEnableGradient'],
    [/show values/i, 'chartShowValues'],
    [/legend/i, 'chartShowLegend'],
    [/grid/i, 'chartShowGrid'],
  ])('toggles %s → %s', (label, key) => {
    const onChange = setup()
    fireEvent.click(screen.getByLabelText(label))
    expect(onChange).toHaveBeenCalledWith({ [key]: false })
  })

  it('treats every unset effect flag as ON, matching the element', () => {
    setup()
    for (const label of [/3d effect/i, /glow/i, /gradient/i, /show values/i, /legend/i, /grid/i]) {
      expect(screen.getByLabelText(label)).toBeChecked()
    }
  })

  it('shows node size only for line charts, defaulting to 8', () => {
    setup({ chartType: 'bar' })
    expect(screen.queryByLabelText(/node size/i)).not.toBeInTheDocument()
  })

  it('edits node size on a line chart → chartNodeSize as a number', () => {
    const onChange = setup({ chartType: 'line' })
    const slider = screen.getByLabelText(/node size/i)
    expect(slider).toHaveValue('8')
    fireEvent.change(slider, { target: { value: '14' } })
    expect(onChange).toHaveBeenCalledWith({ chartNodeSize: 14 })
  })

  it('leaves the data rows to the card', () => {
    setup()
    expect(screen.getByText(/data points are edited on the card/i)).toBeInTheDocument()
  })
})
