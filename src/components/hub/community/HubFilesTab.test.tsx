import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HubFilesTab } from './HubFilesTab'
import type { FileFolder, FileItem } from '@/lib/hub-files-view'

const folders: FileFolder[] = [{ id: 'f1', parentId: null, name: 'Decks', order: 0, locked: false }]
const items: FileItem[] = [
  { id: 'i1', folderId: null, type: 'file', title: 'Root Readme', url: 'https://x/1', order: 0, locked: false },
  { id: 'i2', folderId: 'f1', type: 'file', title: 'Q3 Deck', url: 'https://x/2', order: 0, locked: false },
  { id: 'i3', folderId: 'f1', type: 'file', title: 'Locked Thing', url: null, order: 1, locked: true },
]

describe('HubFilesTab (read)', () => {
  it('shows root items first', () => {
    render(<HubFilesTab hubId="h1" canManage={false} initialFolders={folders} initialItems={items} />)
    expect(screen.getByText('Root Readme')).toBeInTheDocument()
    expect(screen.queryByText('Q3 Deck')).not.toBeInTheDocument()
  })

  it('navigates into a folder', () => {
    render(<HubFilesTab hubId="h1" canManage={false} initialFolders={folders} initialItems={items} />)
    fireEvent.click(screen.getByRole('button', { name: /decks/i }))
    expect(screen.getByText('Q3 Deck')).toBeInTheDocument()
  })

  it('renders no open link for a locked item', () => {
    render(<HubFilesTab hubId="h1" canManage={false} initialFolders={folders} initialItems={items} />)
    fireEvent.click(screen.getByRole('button', { name: /decks/i }))
    expect(screen.getByText('Locked Thing')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /locked thing/i })).not.toBeInTheDocument()
    // the unlocked sibling still links, so this isn't passing by rendering nothing
    expect(screen.getByRole('link', { name: /q3 deck/i })).toBeInTheDocument()
  })

  it('never shows manage controls to a non-manager', () => {
    render(<HubFilesTab hubId="h1" canManage={false} initialFolders={folders} initialItems={items} />)
    expect(screen.queryByRole('button', { name: /new folder/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })
})

describe('HubFilesTab (manage)', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'new' }) })) as any
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('shows manage controls to a manager', () => {
    render(<HubFilesTab hubId="h1" canManage initialFolders={folders} initialItems={items} />)
    expect(screen.getByRole('button', { name: /new folder/i })).toBeInTheDocument()
  })

  it('creates a folder and adds it to the tree', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Contracts')
    render(<HubFilesTab hubId="h1" canManage initialFolders={folders} initialItems={items} />)

    fireEvent.click(screen.getByRole('button', { name: /new folder/i }))

    await vi.waitFor(() => expect(screen.getByRole('button', { name: /contracts/i })).toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith('/api/hubs/h1/folders', expect.objectContaining({ method: 'POST' }))
  })

  it('deletes an item and removes it from the list', async () => {
    render(<HubFilesTab hubId="h1" canManage initialFolders={folders} initialItems={items} />)

    fireEvent.click(screen.getByRole('button', { name: /delete root readme/i }))

    await vi.waitFor(() => expect(screen.queryByText('Root Readme')).not.toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith('/api/hubs/h1/items/i1', { method: 'DELETE' })
  })

  it('keeps the item when the delete confirm is dismissed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<HubFilesTab hubId="h1" canManage initialFolders={folders} initialItems={items} />)

    fireEvent.click(screen.getByRole('button', { name: /delete root readme/i }))

    expect(global.fetch).not.toHaveBeenCalled()
    expect(screen.getByText('Root Readme')).toBeInTheDocument()
  })
})
