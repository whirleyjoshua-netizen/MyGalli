import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CardInspector } from './CardInspector'
import { CARD_PROVIDERS } from '@/lib/cards/registry'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'card',
  cardProvider: 'vouch',
  cardData: {},
  cardStyle: 'default',
  ...over,
} as CanvasElement)

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<CardInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('CardInspector', () => {
  it('sets style → cardStyle', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: /compact/i }))
    expect(onChange).toHaveBeenCalledWith({ cardStyle: 'compact' })
  })

  it('marks the active style', () => {
    setup({ cardStyle: 'detailed' })
    expect(screen.getByRole('button', { name: /detailed/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /compact/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('changing provider resets data and style together', () => {
    const onChange = setup()
    const other = Object.keys(CARD_PROVIDERS).find((p) => p !== 'vouch')
    if (!other) return // single-provider registry — nothing to switch to
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: other } })
    expect(onChange).toHaveBeenCalledWith({
      cardProvider: other,
      cardData: { ...CARD_PROVIDERS[other].defaultData },
      cardStyle: 'default',
    })
  })

  it('renders the provider fields and edits them into cardData', () => {
    const field = CARD_PROVIDERS.vouch.fields[0]
    const onChange = setup({ cardData: { existing: 'keep' } })
    const input = screen.getByLabelText(new RegExp(field.label, 'i'))
    fireEvent.change(input, { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledWith({
      cardData: { existing: 'keep', [field.key]: 'hello' },
    })
  })

  it('shows current field values from cardData', () => {
    const field = CARD_PROVIDERS.vouch.fields.find((f) => f.type !== 'number')!
    setup({ cardData: { [field.key]: 'stored' } })
    expect(screen.getByLabelText(new RegExp(field.label, 'i'))).toHaveValue('stored')
  })
})
