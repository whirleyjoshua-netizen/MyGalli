import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommunityTabs, tabFromParam } from './CommunityTabs'

describe('tabFromParam', () => {
  it('maps "files" to files and everything else to home', () => {
    expect(tabFromParam('files')).toBe('files')
    expect(tabFromParam(null)).toBe('home')
    expect(tabFromParam('')).toBe('home')
    expect(tabFromParam('nonsense')).toBe('home')
  })

  it('maps the pages param to the pages tab', () => {
    expect(tabFromParam('pages')).toBe('pages')
  })
})

describe('CommunityTabs', () => {
  it('marks the active tab for assistive tech', () => {
    render(<CommunityTabs active="files" onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: /files/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /home/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('reports the selected tab', () => {
    const onSelect = vi.fn()
    render(<CommunityTabs active="home" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('tab', { name: /files/i }))
    expect(onSelect).toHaveBeenCalledWith('files')
  })

  it('renders a Pages tab', () => {
    render(<CommunityTabs active="home" onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: /pages/i })).toBeInTheDocument()
  })
})
