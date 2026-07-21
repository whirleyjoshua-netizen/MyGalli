import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { UserPickerModal } from './UserPickerModal'

const users = (...names: string[]) => ({
  users: names.map((n) => ({ username: n, name: null, avatar: null, isFollowing: true })),
})

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn(async (url: any) => {
    const href = String(url)
    if (href.includes('/followers')) return { ok: true, json: async () => users('sarah', 'bob') } as any
    if (href.includes('/following')) return { ok: true, json: async () => users('sarah') } as any
    return { ok: true, json: async () => ({ users: [] }) } as any
  }) as any
})

describe('UserPickerModal', () => {
  it('lists the merged social graph', async () => {
    render(<UserPickerModal myUsername="me" onSelect={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('@sarah')).toBeInTheDocument())
    expect(screen.getByText('@bob')).toBeInTheDocument()
  })

  it('fetches both lists for the viewer', async () => {
    render(<UserPickerModal myUsername="me" onSelect={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/users/me/followers', expect.anything())
    )
    expect(global.fetch).toHaveBeenCalledWith('/api/users/me/following', expect.anything())
  })

  it('filters rows as the user types', async () => {
    render(<UserPickerModal myUsername="me" onSelect={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('@bob')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'sarah' } })
    expect(screen.queryByText('@bob')).not.toBeInTheDocument()
    expect(screen.getByText('@sarah')).toBeInTheDocument()
  })

  it('calls onSelect with the username of the clicked row', async () => {
    const onSelect = vi.fn()
    render(<UserPickerModal myUsername="me" onSelect={onSelect} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('@bob')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /bob/ }))
    expect(onSelect).toHaveBeenCalledWith('bob')
  })

  it('sorts mutuals first and flags them', async () => {
    render(<UserPickerModal myUsername="me" onSelect={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('@sarah')).toBeInTheDocument())
    const handles = screen.getAllByText(/^@/).map((el) => el.textContent)
    expect(handles).toEqual(['@sarah', '@bob'])
    expect(screen.getByText('Friend')).toBeInTheDocument()
  })

  it('offers a free-text username fallback when the graph is empty', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ users: [] }) })) as any
    const onSelect = vi.fn()
    render(<UserPickerModal myUsername="me" onSelect={onSelect} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'stranger' } })
    fireEvent.click(screen.getByRole('button', { name: /message @stranger/i }))
    expect(onSelect).toHaveBeenCalledWith('stranger')
  })

  it('closes when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(<UserPickerModal myUsername="me" onSelect={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('survives a failed fetch without crashing', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    render(<UserPickerModal myUsername="me" onSelect={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument())
  })
})
