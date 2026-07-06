import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    render(<HubViewer hub={hub} folders={folders} items={items} username="alice" />)
    expect(screen.getByText('Root Note')).toBeInTheDocument()
    expect(screen.queryByText('A Link')).not.toBeInTheDocument()
  })

  it('clicking a folder shows its children', () => {
    render(<HubViewer hub={hub} folders={folders} items={items} username="alice" />)
    fireEvent.click(screen.getByText('Docs'))
    expect(screen.getByText('A Link')).toBeInTheDocument()
    expect(screen.getByText('A File')).toBeInTheDocument()
    expect(screen.queryByText('Root Note')).not.toBeInTheDocument()
  })

  it('renders an item with an Open link with the correct href', () => {
    render(<HubViewer hub={hub} folders={folders} items={items} username="alice" />)
    fireEvent.click(screen.getByText('Docs'))
    const link = screen.getAllByRole('link', { name: /open/i })[0] as HTMLAnchorElement
    // there may be more than one Open link; just check the first matches one of the hrefs
    expect(['https://example.com', 'https://example.com/file.pdf']).toContain(link.getAttribute('href'))
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })
})
