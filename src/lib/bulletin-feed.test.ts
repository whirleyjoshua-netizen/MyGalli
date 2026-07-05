import { describe, it, expect } from 'vitest'
import { assembleFeedPosts } from './bulletin-feed'

const author = { id: 'u2', name: 'Bea', username: 'bea', avatar: null }
const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1', text: 'hi', imageUrl: null, blocks: [], settings: {},
  createdAt: new Date('2026-07-01T00:00:00Z'), authorId: 'u2', author, ...over,
})

describe('assembleFeedPosts', () => {
  it('maps like counts, likedByMe, and ISO createdAt; preserves input order', () => {
    const posts = [row({ id: 'p1' }), row({ id: 'p2' })]
    const out = assembleFeedPosts(
      posts,
      [{ postId: 'p1', _count: { postId: 3 } }],
      [{ postId: 'p2' }],
      [],
      'me',
    )
    expect(out.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(out[0].likeCount).toBe(3)
    expect(out[0].likedByMe).toBe(false)
    expect(out[1].likeCount).toBe(0)
    expect(out[1].likedByMe).toBe(true)
    expect(out[0].createdAt).toBe('2026-07-01T00:00:00.000Z')
    expect(out[0].block).toBeNull()
  })

  it('hides results for a non-author until they answer when revealAfterAnswer is set', () => {
    const block = { id: 'b', type: 'poll', pollQuestion: 'Q', pollOptions: ['A', 'B'] }
    const posts = [row({ id: 'p1', blocks: [block], settings: { revealAfterAnswer: true }, authorId: 'u2' })]
    const noAnswer = assembleFeedPosts(posts, [], [], [], 'me')
    expect(noAnswer[0].results).toBeNull()
    expect(noAnswer[0].myResponse).toBeNull()

    const answered = assembleFeedPosts(
      posts, [], [],
      [{ postId: 'p1', userId: 'me', responses: { b: { type: 'poll', answer: 0 } }, createdAt: new Date(), user: { name: null, username: 'me', avatar: null } }],
      'me',
    )
    expect(answered[0].results).not.toBeNull()
    expect(answered[0].myResponse).toEqual({ b: { type: 'poll', answer: 0 } })
  })
})
