import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HubPostComments } from './HubPostComments'

const base = { hubId: 'h1', postId: 'p1', canComment: true, canModerate: false, currentUserId: 'u1' }

beforeEach(() => {
  vi.restoreAllMocks()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ comments: [] }),
  }) as unknown as typeof fetch
})

describe('HubPostComments live count', () => {
  it('adopts a new count while the thread is closed', () => {
    const { rerender } = render(<HubPostComments {...base} initialCount={1} />)
    expect(screen.getByText(/1 comment/i)).toBeInTheDocument()
    rerender(<HubPostComments {...base} initialCount={4} />)
    expect(screen.getByText(/4 comments/i)).toBeInTheDocument()
  })

  // Once open, the component owns the count — the user may have just replied.
  it('ignores a count sync while the thread is open', () => {
    const { rerender } = render(<HubPostComments {...base} initialCount={1} />)
    fireEvent.click(screen.getByText(/1 comment/i))
    rerender(<HubPostComments {...base} initialCount={4} />)
    expect(screen.queryByText(/4 comments/i)).toBeNull()
  })

  it('keeps the optimistic incremented count after closing the thread (no stale revert)', async () => {
    render(<HubPostComments {...base} initialCount={1} />)
    fireEvent.click(screen.getByText(/1 comment/i))
    const input = await screen.findByPlaceholderText(/write a comment/i)
    fireEvent.change(input, { target: { value: 'hello' } })
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ comment: { id: 'c1', author: { id: 'u1', name: 'A', username: 'a', avatar: null }, text: 'hello', createdAt: '' } }),
    })
    fireEvent.click(screen.getByText('Post'))
    expect(await screen.findByText(/2 comments/i)).toBeInTheDocument()
    // Close the thread without any new poll (initialCount still 1).
    fireEvent.click(screen.getByText(/2 comments/i))
    expect(screen.getByText(/2 comments/i)).toBeInTheDocument()
    expect(screen.queryByText(/1 comment\b/i)).toBeNull()
  })

  it('adopts a genuinely new count that arrives while closed after previously being open', () => {
    const { rerender } = render(<HubPostComments {...base} initialCount={1} />)
    fireEvent.click(screen.getByText(/1 comment/i))
    fireEvent.click(screen.getByText(/1 comment/i))
    rerender(<HubPostComments {...base} initialCount={5} />)
    expect(screen.getByText(/5 comments/i)).toBeInTheDocument()
  })
})
