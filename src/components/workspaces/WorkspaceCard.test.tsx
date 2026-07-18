import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkspaceCard, type WorkspaceListItem } from './WorkspaceCard'

const base: WorkspaceListItem = {
  id: 'w1', name: 'Students', description: 'Grade & class tracking', icon: '🎓',
  recordCount: 12, fieldCount: 4, primaryView: 'grid',
  lastActivity: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
}

describe('WorkspaceCard', () => {
  it('renders name, description, count, view badge, and relative updated time', () => {
    render(<WorkspaceCard ws={base} layout="grid" />)
    expect(screen.getByText('Students')).toBeInTheDocument()
    expect(screen.getByText(/Grade & class tracking/)).toBeInTheDocument()
    expect(screen.getByText(/12 records/)).toBeInTheDocument()
    expect(screen.getByText(/Grid view/i)).toBeInTheDocument()
    expect(screen.getByText(/Updated 3 hours/)).toBeInTheDocument()
  })
  it('links to the workspace', () => {
    render(<WorkspaceCard ws={base} layout="grid" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/workspaces/w1')
  })
  it('handles zero records and no views', () => {
    render(<WorkspaceCard ws={{ ...base, recordCount: 0, primaryView: null }} layout="grid" />)
    expect(screen.getByText(/0 records/)).toBeInTheDocument()
    expect(screen.getByText(/No views/i)).toBeInTheDocument()
  })
  it('singularizes one record', () => {
    render(<WorkspaceCard ws={{ ...base, recordCount: 1 }} layout="grid" />)
    expect(screen.getByText(/1 record\b/)).toBeInTheDocument()
  })
})
