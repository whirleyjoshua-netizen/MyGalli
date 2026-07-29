import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { JerseyInspector } from './JerseyInspector'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'jersey',
  jerseyNumber: '1', jerseyName: 'PLAYER',
  jerseyPrimaryColor: '#39D98A', jerseySecondaryColor: '#0F3D2E',
  jerseyStyle: 'classic', jerseySignaturesEnabled: true,
  ...over,
} as CanvasElement)

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<JerseyInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('JerseyInspector', () => {
  it('edits number → jerseyNumber', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/number/i), { target: { value: '23' } })
    expect(onChange).toHaveBeenCalledWith({ jerseyNumber: '23' })
  })

  it('edits name → jerseyName', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'JORDAN' } })
    expect(onChange).toHaveBeenCalledWith({ jerseyName: 'JORDAN' })
  })

  it('edits primary and secondary colours', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/primary colour/i), { target: { value: '#ff0000' } })
    expect(onChange).toHaveBeenCalledWith({ jerseyPrimaryColor: '#ff0000' })
    fireEvent.change(screen.getByLabelText(/secondary colour/i), { target: { value: '#0000ff' } })
    expect(onChange).toHaveBeenCalledWith({ jerseySecondaryColor: '#0000ff' })
  })

  it('sets style → jerseyStyle', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: /retro/i }))
    expect(onChange).toHaveBeenCalledWith({ jerseyStyle: 'retro' })
  })

  it('toggles fan signatures → jerseySignaturesEnabled', () => {
    const onChange = setup({ jerseySignaturesEnabled: true })
    fireEvent.click(screen.getByLabelText(/fan signatures/i))
    expect(onChange).toHaveBeenCalledWith({ jerseySignaturesEnabled: false })
  })

  it('treats an unset flag as enabled, matching the element and public renderer', () => {
    setup({ jerseySignaturesEnabled: undefined })
    expect(screen.getByLabelText(/fan signatures/i)).toBeChecked()
  })

  it('reflects the element state', () => {
    setup({ jerseyStyle: 'modern', jerseySignaturesEnabled: true })
    expect(screen.getByRole('button', { name: /modern/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/fan signatures/i)).toBeChecked()
  })

  it('caps number and name lengths like the old panel did', () => {
    setup()
    expect(screen.getByLabelText(/number/i)).toHaveAttribute('maxLength', '3')
    expect(screen.getByLabelText(/^name$/i)).toHaveAttribute('maxLength', '20')
  })
})
