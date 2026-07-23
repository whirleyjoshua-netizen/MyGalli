import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppearanceSection } from './AppearanceSection'
import { DEFAULT_HUB_CONFIG } from '@/lib/types/hub-config'
import { HUB_THEMES } from '@/lib/hub-themes'

describe('AppearanceSection', () => {
  it('offers every preset', () => {
    render(<AppearanceSection config={DEFAULT_HUB_CONFIG} onChange={() => {}} />)
    for (const t of HUB_THEMES) {
      expect(screen.getByRole('button', { name: new RegExp(t.label, 'i') })).toBeInTheDocument()
    }
  })

  it('marks the active preset', () => {
    const config = { ...DEFAULT_HUB_CONFIG, appearance: { theme: 'ocean' as const } }
    render(<AppearanceSection config={config} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /ocean/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /sunset/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the chosen theme without disturbing the rest of the config', () => {
    const onChange = vi.fn()
    render(<AppearanceSection config={DEFAULT_HUB_CONFIG} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /sunset/i }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_HUB_CONFIG, appearance: { theme: 'sunset' } })
  })
})
