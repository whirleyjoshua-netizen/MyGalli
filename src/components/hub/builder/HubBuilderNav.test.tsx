import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HubBuilderNav } from './HubBuilderNav'

describe('HubBuilderNav', () => {
  it('offers Appearance as a real, selectable section', () => {
    const onSelect = vi.fn()
    render(<HubBuilderNav active="settings" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /appearance/i }))
    expect(onSelect).toHaveBeenCalledWith('appearance')
  })

  it('still lists SEO & Sharing as coming soon, not as a button', () => {
    // Only Appearance graduates in this change.
    render(<HubBuilderNav active="settings" onSelect={() => {}} />)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /seo/i })).not.toBeInTheDocument()
    expect(screen.getByText(/seo & sharing/i)).toBeInTheDocument()
  })
})
