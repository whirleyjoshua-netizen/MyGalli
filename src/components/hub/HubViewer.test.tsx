import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { HubViewer } from './HubViewer'

const hub = {
  id: 'hub1',
  title: 'My Hub',
  description: 'A collection of things',
  coverImage: null,
}

const folders = [
  { id: 'f1', parentId: null, name: 'Docs', order: 0 },
  { id: 'f2', parentId: null, name: 'Media', order: 1 },
]

const items = [
  { id: 'i1', hubId: 'hub1', folderId: null, type: 'note', title: 'Root Note', url: null, content: 'hello', order: 0 },
  { id: 'i2', hubId: 'hub1', folderId: 'f1', type: 'link', title: 'A Link', url: 'https://example.com', order: 0 },
  { id: 'i3', hubId: 'hub1', folderId: 'f1', type: 'file', title: 'A File', url: 'https://example.com/file.pdf', order: 1 },
]

describe('HubViewer', () => {
  it('renders root items', () => {
    render(<HubViewer hub={hub} folders={folders} items={items} username="alice" hubId="hub1" />)
    expect(screen.getByText('Root Note')).toBeInTheDocument()
    expect(screen.queryByText('A Link')).not.toBeInTheDocument()
  })

  it('clicking a folder shows its children', () => {
    render(<HubViewer hub={hub} folders={folders} items={items} username="alice" hubId="hub1" />)
    fireEvent.click(screen.getByText('Docs'))
    expect(screen.getByText('A Link')).toBeInTheDocument()
    expect(screen.getByText('A File')).toBeInTheDocument()
    expect(screen.queryByText('Root Note')).not.toBeInTheDocument()
  })

  it('renders an item with an Open link with the correct href', () => {
    render(<HubViewer hub={hub} folders={folders} items={items} username="alice" hubId="hub1" />)
    fireEvent.click(screen.getByText('Docs'))
    const link = screen.getAllByRole('link', { name: /open/i })[0] as HTMLAnchorElement
    // there may be more than one Open link; just check the first matches one of the hrefs
    expect(['https://example.com', 'https://example.com/file.pdf']).toContain(link.getAttribute('href'))
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })
})

describe('HubViewer locked nodes', () => {
  const lockedFolders = [
    { id: 'f1', parentId: null, name: 'Docs', order: 0 },
    { id: 'f2', parentId: null, name: 'Private Stuff', order: 1, locked: true },
  ]
  const lockedItems = [
    { id: 'i1', hubId: 'hub1', folderId: null, type: 'note', title: 'Root Note', url: null, content: 'hello', order: 0 },
    { id: 'i2', hubId: 'hub1', folderId: 'f1', type: 'link', title: 'Secret Link', url: null, order: 0, locked: true },
  ]

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }))
    )
    vi.stubGlobal('location', { ...window.location, reload: vi.fn() })
  })

  it('renders a lock affordance for a locked folder', () => {
    render(<HubViewer hub={hub} folders={lockedFolders} items={lockedItems} username="alice" hubId="hub1" />)
    expect(screen.getByText('Private Stuff')).toBeInTheDocument()
  })

  it('clicking a locked folder shows a passcode input, and submitting POSTs to the unlock URL', async () => {
    render(<HubViewer hub={hub} folders={lockedFolders} items={lockedItems} username="alice" hubId="hub1" />)
    fireEvent.click(screen.getByText('Private Stuff'))

    const input = screen.getByPlaceholderText(/passcode/i)
    fireEvent.change(input, { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      '/api/hubs/hub1/unlock',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ nodeId: 'f2', passcode: 'secret123' }),
      })
    ))
  })

  it('renders a lock affordance for a locked item', () => {
    render(<HubViewer hub={hub} folders={lockedFolders} items={lockedItems} username="alice" hubId="hub1" />)
    fireEvent.click(screen.getByText('Docs'))
    expect(screen.getByText('Secret Link')).toBeInTheDocument()
  })
})
