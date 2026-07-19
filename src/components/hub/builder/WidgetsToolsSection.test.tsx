import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WidgetsToolsSection } from './WidgetsToolsSection'
import { DEFAULT_HUB_CONFIG } from '@/lib/types/hub-config'

describe('WidgetsToolsSection', () => {
  it('lists the three utility cards with labels', () => {
    render(<WidgetsToolsSection config={DEFAULT_HUB_CONFIG} onChange={() => {}} hubId="h1" />)
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Kollab AI')).toBeInTheDocument()
    expect(screen.getByText('Tools')).toBeInTheDocument()
  })

  it('toggles a card off through onChange', async () => {
    const onChange = vi.fn()
    render(<WidgetsToolsSection config={DEFAULT_HUB_CONFIG} onChange={onChange} hubId="h1" />)
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].utility[0]).toEqual({ key: 'notes', enabled: false })
  })
})
