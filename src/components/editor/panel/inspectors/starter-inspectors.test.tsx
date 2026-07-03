import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { getInspector } from './registry'

describe('starter inspectors', () => {
  it('Image inspector edits url + alt', () => {
    const onChange = vi.fn()
    const Inspector = getInspector('image')
    render(<Inspector element={{ id: 'e', type: 'image', url: '', alt: '' }} onChange={onChange} isPro={false} />)
    fireEvent.change(screen.getByLabelText(/image url/i), { target: { value: 'https://x/a.jpg' } })
    expect(onChange).toHaveBeenCalledWith({ url: 'https://x/a.jpg' })
  })
  it('KPI inspector edits label', () => {
    const onChange = vi.fn()
    const Inspector = getInspector('kpi')
    render(<Inspector element={{ id: 'e', type: 'kpi', kpiLabel: '' }} onChange={onChange} isPro={false} />)
    fireEvent.change(screen.getByLabelText(/label/i), { target: { value: 'Revenue' } })
    expect(onChange).toHaveBeenCalledWith({ kpiLabel: 'Revenue' })
  })
  it('Button inspector edits text', () => {
    const onChange = vi.fn()
    const Inspector = getInspector('button')
    render(<Inspector element={{ id: 'e', type: 'button', buttonText: '' }} onChange={onChange} isPro={false} />)
    fireEvent.change(screen.getByLabelText(/button text/i), { target: { value: 'Buy' } })
    expect(onChange).toHaveBeenCalledWith({ buttonText: 'Buy' })
  })
})
