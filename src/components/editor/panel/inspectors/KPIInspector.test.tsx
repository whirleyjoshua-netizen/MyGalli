import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KPIInspector } from './KPIInspector'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'kpi',
  kpiLabel: 'Revenue', kpiValue: '42', kpiPrefix: '$', kpiSuffix: '%',
  kpiTrend: 'neutral', kpiTrendValue: '', kpiColor: 'blue',
  ...over,
} as CanvasElement)

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<KPIInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('KPIInspector', () => {
  it('edits label → kpiLabel', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/^label$/i), { target: { value: 'Sales' } })
    expect(onChange).toHaveBeenCalledWith({ kpiLabel: 'Sales' })
  })

  it('edits value → kpiValue', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/^value$/i), { target: { value: '99' } })
    expect(onChange).toHaveBeenCalledWith({ kpiValue: '99' })
  })

  it('edits prefix and suffix', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/prefix/i), { target: { value: '€' } })
    fireEvent.change(screen.getByLabelText(/suffix/i), { target: { value: 'k' } })
    expect(onChange).toHaveBeenCalledWith({ kpiPrefix: '€' })
    expect(onChange).toHaveBeenCalledWith({ kpiSuffix: 'k' })
  })

  it('sets trend direction', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: /up/i }))
    expect(onChange).toHaveBeenCalledWith({ kpiTrend: 'up' })
  })

  it('edits trend text → kpiTrendValue', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/trend text/i), { target: { value: '+12%' } })
    expect(onChange).toHaveBeenCalledWith({ kpiTrendValue: '+12%' })
  })

  it('picks a colour → kpiColor', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: /green/i }))
    expect(onChange).toHaveBeenCalledWith({ kpiColor: 'green' })
  })

  it('marks the active trend and colour from the element', () => {
    setup({ kpiTrend: 'down', kpiColor: 'purple' })
    expect(screen.getByRole('button', { name: /down/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /purple/i })).toHaveAttribute('aria-pressed', 'true')
  })
})
