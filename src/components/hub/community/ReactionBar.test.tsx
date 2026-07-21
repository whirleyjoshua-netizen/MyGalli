import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReactionBar } from './ReactionBar'

const sum = (counts: Record<string, number>, mine: string[] = []) => ({ counts, mine })

beforeEach(() => { vi.restoreAllMocks() })

describe('ReactionBar live updates', () => {
  it('renders the initial counts', () => {
    render(<ReactionBar postId="p1" basePath="/api/hubs/h1/posts" initial={sum({ '❤️': 2 })} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('adopts a new count when the prop changes', () => {
    const { rerender } = render(<ReactionBar postId="p1" basePath="/api/hubs/h1/posts" initial={sum({ '❤️': 2 })} />)
    rerender(<ReactionBar postId="p1" basePath="/api/hubs/h1/posts" initial={sum({ '❤️': 5 })} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  // The race: a poll in flight when the user taps must not revert their tap.
  it('ignores a stale prop sync while its own write is unsettled', async () => {
    let resolveFetch: (v: unknown) => void = () => {}
    global.fetch = vi.fn(() => new Promise((r) => { resolveFetch = r })) as any

    const { rerender } = render(
      <ReactionBar postId="p1" basePath="/api/hubs/h1/posts" initial={sum({ '❤️': 2 }, [])} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /❤️/ }))
    expect(await screen.findByText('3')).toBeInTheDocument()   // optimistic

    // A poll lands with pre-tap data while our request is still open.
    rerender(<ReactionBar postId="p1" basePath="/api/hubs/h1/posts" initial={sum({ '❤️': 2 }, [])} />)
    expect(screen.getByText('3')).toBeInTheDocument()          // must NOT revert to 2

    resolveFetch({ ok: true, status: 200, json: async () => sum({ '❤️': 3 }, ['❤️']) })
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
  })

  it('accepts prop syncs again once its own write has settled', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => sum({ '❤️': 3 }, ['❤️']) })) as any
    const { rerender } = render(
      <ReactionBar postId="p1" basePath="/api/hubs/h1/posts" initial={sum({ '❤️': 2 }, [])} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /❤️/ }))
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())

    rerender(<ReactionBar postId="p1" basePath="/api/hubs/h1/posts" initial={sum({ '❤️': 9 }, ['❤️'])} />)
    await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument())
  })
})
