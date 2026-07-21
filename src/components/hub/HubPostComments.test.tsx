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
})
