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

describe('HubFilesTab (upload)', () => {
  const pdf = () => new File(['%PDF-1.4'], 'contract.pdf', { type: 'application/pdf' })

  // Two-step flow: POST /api/upload -> { url }, then POST items with that url.
  const okUpload = () => vi.fn(async (url: string) => {
    if (String(url) === '/api/upload') return { ok: true, json: async () => ({ url: 'https://blob/contract.pdf' }) }
    return { ok: true, json: async () => ({ id: 'new-item' }) }
  }) as any

  beforeEach(() => { global.fetch = okUpload() })

  it('offers no upload control to a non-manager', () => {
    render(<HubFilesTab hubId="h1" canManage={false} initialFolders={folders} initialItems={items} />)
    expect(screen.queryByLabelText(/upload/i)).not.toBeInTheDocument()
  })

  it('uploads a file, creates the item, and shows it in the list', async () => {
    render(<HubFilesTab hubId="h1" canManage initialFolders={folders} initialItems={items} />)

    const input = screen.getByLabelText(/upload/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [pdf()] } })

    await vi.waitFor(() => expect(screen.getByText('contract.pdf')).toBeInTheDocument())

    const calls = (global.fetch as any).mock.calls
    expect(calls[0][0]).toBe('/api/upload')
    expect(calls[0][1].body).toBeInstanceOf(FormData)
    expect(calls[1][0]).toBe('/api/hubs/h1/items')
    const sent = JSON.parse(calls[1][1].body)
    expect(sent).toMatchObject({ type: 'file', title: 'contract.pdf', url: 'https://blob/contract.pdf' })
  })

  it('files the upload into the folder the user is looking at', async () => {
    render(<HubFilesTab hubId="h1" canManage initialFolders={folders} initialItems={items} />)
    fireEvent.click(screen.getByRole('button', { name: /decks/i }))

    fireEvent.change(screen.getByLabelText(/upload/i), { target: { files: [pdf()] } })

    await vi.waitFor(() => expect((global.fetch as any).mock.calls.length).toBe(2))
    expect(JSON.parse((global.fetch as any).mock.calls[1][1].body).folderId).toBe('f1')
  })

  it('surfaces the server error and creates no item when the upload is rejected', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ error: 'File too large' }) })) as any
    render(<HubFilesTab hubId="h1" canManage initialFolders={folders} initialItems={items} />)

    fireEvent.change(screen.getByLabelText(/upload/i), { target: { files: [pdf()] } })

    await vi.waitFor(() => expect(screen.getByText(/file too large/i)).toBeInTheDocument())
    // must not have gone on to create an item pointing at nothing
    expect((global.fetch as any).mock.calls.length).toBe(1)
    expect(screen.queryByText('contract.pdf')).not.toBeInTheDocument()
  })

  it('surfaces an error when the item create fails after a successful upload', async () => {
    global.fetch = vi.fn(async (url: string) =>
      String(url) === '/api/upload'
        ? { ok: true, json: async () => ({ url: 'https://blob/contract.pdf' }) }
        : { ok: false, json: async () => ({ error: 'Not found' }) }) as any
    render(<HubFilesTab hubId="h1" canManage initialFolders={folders} initialItems={items} />)

    fireEvent.change(screen.getByLabelText(/upload/i), { target: { files: [pdf()] } })

    await vi.waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument())
    expect(screen.queryByText('contract.pdf')).not.toBeInTheDocument()
  })
})
