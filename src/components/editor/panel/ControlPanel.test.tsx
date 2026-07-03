import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ControlPanel } from './ControlPanel'

const base = {
  collapsed: false,
  onToggleCollapsed: vi.fn(),
  activeTab: 'elements' as const,
  onTabChange: vi.fn(),
  elementsSlot: <div>ELEMENTS_SLOT</div>,
  pageSlot: <div>PAGE_SLOT</div>,
}

describe('ControlPanel', () => {
  it('shows the active tab slot and both tab buttons when expanded', () => {
    render(<ControlPanel {...base} />)
    expect(screen.getByText('ELEMENTS_SLOT')).toBeInTheDocument()
    expect(screen.queryByText('PAGE_SLOT')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /elements/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /page/i })).toBeInTheDocument()
  })
  it('calls onTabChange when the Page tab is clicked', () => {
    const onTabChange = vi.fn()
    render(<ControlPanel {...base} onTabChange={onTabChange} />)
    fireEvent.click(screen.getByRole('button', { name: /page/i }))
    expect(onTabChange).toHaveBeenCalledWith('page')
  })
  it('when collapsed, hides slots and shows an expand control', () => {
    render(<ControlPanel {...base} collapsed />)
    expect(screen.queryByText('ELEMENTS_SLOT')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /expand panel/i }))
    expect(base.onToggleCollapsed).toHaveBeenCalled()
  })
})
