import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CommunityFeed, FEED_POLL_MS } from './CommunityFeed'
import { DEFAULT_HUB_CONFIG } from '@/lib/types/hub-config'

vi.mock('@/components/bulletin/BulletinPostCard', () => ({
  BulletinPostCard: ({ post }: any) => <div data-testid="post">{post.text}</div>,
}))
vi.mock('@/components/hub/HubPostComments', () => ({ HubPostComments: () => null }))
vi.mock('@/components/hub/HubPostComposer', () => ({ HubPostComposer: () => null }))
vi.mock('@/components/hub/ReportButton', () => ({ ReportButton: () => null }))

const post = (id: string, text: string, extra: Record<string, unknown> = {}) => ({
  id, text, imageUrl: null, block: null, settings: { revealAfterAnswer: false, liveTally: true },
  createdAt: '2026-07-20T00:00:00.000Z', myResponse: null, results: null,
  author: { id: 'a1', name: 'A', username: 'a', avatar: null }, ...extra,
})

const feed = (posts: unknown[]) => ({ ok: true, json: async () => ({ posts }) })
const base = { hubId: 'h1', canPost: true, isPrivileged: false, currentUserId: 'me', config: DEFAULT_HUB_CONFIG }

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); vi.restoreAllMocks() })
afterEach(() => { vi.useRealTimers() })

const tick = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(FEED_POLL_MS) }) }

describe('CommunityFeed live polling', () => {
  it('buffers a new post behind a pill instead of inserting it', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(feed([post('p1', 'first')]))
      .mockResolvedValue(feed([post('p2', 'second'), post('p1', 'first')])) as any
    render(<CommunityFeed {...base} />)
    expect(await screen.findByText('first')).toBeInTheDocument()

    await tick()
    expect(await screen.findByText(/1 new post/i)).toBeInTheDocument()
    expect(screen.queryByText('second')).toBeNull()          // not inserted
  })

  it('inserts buffered posts when the pill is clicked', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(feed([post('p1', 'first')]))
      .mockResolvedValue(feed([post('p2', 'second'), post('p1', 'first')])) as any
    render(<CommunityFeed {...base} />)
    await screen.findByText('first')
    await tick()
    fireEvent.click(await screen.findByText(/1 new post/i))
    expect(await screen.findByText('second')).toBeInTheDocument()
    expect(screen.queryByText(/new post/i)).toBeNull()       // pill cleared
  })

  it('does not inflate the pill across repeated polls', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(feed([post('p1', 'first')]))
      .mockResolvedValue(feed([post('p2', 'second'), post('p1', 'first')])) as any
    render(<CommunityFeed {...base} />)
    await screen.findByText('first')
    await tick(); await tick(); await tick()
    expect(await screen.findByText(/1 new post/i)).toBeInTheDocument()
  })

  it('merges counts on a visible post in place, without a pill', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(feed([post('p1', 'first', { commentCount: 0 })]))
      .mockResolvedValue(feed([post('p1', 'first', { commentCount: 7 })])) as any
    const { container } = render(<CommunityFeed {...base} />)
    await screen.findByText('first')
    await tick()
    expect(screen.queryByText(/new post/i)).toBeNull()
    expect(container.querySelectorAll('[data-testid="post"]').length).toBe(1)
  })

  it('does not poll when the tab is hidden', async () => {
    global.fetch = vi.fn().mockResolvedValue(feed([post('p1', 'first')])) as any
    render(<CommunityFeed {...base} />)
    await screen.findByText('first')
    const calls = (global.fetch as any).mock.calls.length
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await tick()
    expect((global.fetch as any).mock.calls.length).toBe(calls)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('does not fetch at all in preview mode', async () => {
    global.fetch = vi.fn() as any
    render(<CommunityFeed {...base} preview />)
    await tick()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('keeps the feed intact when a poll fails', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(feed([post('p1', 'first')]))
      .mockRejectedValue(new Error('offline')) as any
    render(<CommunityFeed {...base} />)
    await screen.findByText('first')
    await tick()
    expect(screen.getByText('first')).toBeInTheDocument()
  })
})
