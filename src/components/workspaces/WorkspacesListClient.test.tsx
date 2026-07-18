import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WorkspacesListClient } from './WorkspacesListClient'

const items = [
  { id: 'w1', name: 'Students', description: 'roster', icon: '🎓', recordCount: 12, fieldCount: 4, primaryView: 'grid', lastActivity: new Date().toISOString() },
  { id: 'w2', name: 'Budget', description: 'money', icon: '💰', recordCount: 3, fieldCount: 2, primaryView: 'kanban', lastActivity: new Date(Date.now() - 86400000).toISOString() },
]

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

function mockList(data: any) {
  vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => data } as any)
}

describe('WorkspacesListClient', () => {
  it('renders rich cards for each workspace', async () => {
    mockList(items)
    render(<WorkspacesListClient />)
    await waitFor(() => expect(screen.getByText('Students')).toBeInTheDocument())
    expect(screen.getByText('Budget')).toBeInTheDocument()
  })

  it('search narrows the list', async () => {
    mockList(items)
    render(<WorkspacesListClient />)
    await waitFor(() => screen.getByText('Students'))
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'bud' } })
    expect(screen.queryByText('Students')).not.toBeInTheDocument()
    expect(screen.getByText('Budget')).toBeInTheDocument()
  })

  it('shows the welcoming empty state (with feature tour) when there are no workspaces', async () => {
    mockList([])
    render(<WorkspacesListClient />)
    await waitFor(() => expect(screen.getByText(/No workspaces yet/i)).toBeInTheDocument())
    // feature tour still renders so new users see the value
    expect(screen.getByText(/What you can do in Workspaces/i)).toBeInTheDocument()
  })

  it('persists the layout toggle to localStorage', async () => {
    mockList(items)
    render(<WorkspacesListClient />)
    await waitFor(() => screen.getByText('Students'))
    fireEvent.click(screen.getByRole('button', { name: /list view/i }))
    expect(localStorage.getItem('galli-ws-layout')).toBe('list')
  })
})
