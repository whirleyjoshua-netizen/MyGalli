import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { bulletinPost: { findMany: vi.fn() } },
}))

import { GET } from './route'
import { db } from '@/lib/db'
import * as auth from '@/lib/auth'

const req = () => new NextRequest('http://localhost/api/bulletin/analytics')

const authed = (user: unknown) => {
  ;(auth.getUser as any).mockResolvedValue(user)
}

const pollBlock = {
  id: 'el-1',
  type: 'poll',
  pollQuestion: 'Favorite color?',
  pollOptions: ['Red', 'Blue'],
  pollAllowMultiple: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.bulletinPost.findMany as any).mockResolvedValue([])
})

describe('GET /api/bulletin/analytics', () => {
  it('401s when unauthenticated', async () => {
    authed(null)
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('does not query the db when unauthenticated', async () => {
    authed(null)
    await GET(req())
    expect(db.bulletinPost.findMany).not.toHaveBeenCalled()
  })

  it("scopes the query to the caller's own posts via authorId", async () => {
    authed({ id: 'me' })
    await GET(req())
    expect(db.bulletinPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { authorId: 'me' } })
    )
  })

  it('returns an empty posts array when the caller has no posts', async () => {
    authed({ id: 'me' })
    const body = await (await GET(req())).json()
    expect(body).toEqual({ posts: [] })
  })

  it('drops posts with no blocks or an unaggregatable block type', async () => {
    authed({ id: 'me' })
    ;(db.bulletinPost.findMany as any).mockResolvedValue([
      { id: 'p-empty', text: 'no blocks', createdAt: new Date('2026-01-01'), blocks: [], responses: [] },
      {
        id: 'p-unknown',
        text: 'weird block',
        createdAt: new Date('2026-01-01'),
        blocks: [{ id: 'el-x', type: 'nonsense' }],
        responses: [],
      },
    ])
    const body = await (await GET(req())).json()
    expect(body.posts).toEqual([])
  })

  it('shapes results the drawer relies on: posts[].id and posts[].results.respondents[].{user.name,answer}', async () => {
    authed({ id: 'me' })
    ;(db.bulletinPost.findMany as any).mockResolvedValue([
      {
        id: 'post-1',
        text: 'Pick one',
        createdAt: new Date('2026-01-05T00:00:00.000Z'),
        blocks: [pollBlock],
        responses: [
          {
            userId: 'u-1',
            responses: { 'el-1': { type: 'poll', answer: 'Red' } },
            createdAt: new Date('2026-01-06T00:00:00.000Z'),
            user: { name: 'Alice', username: 'alice', avatar: null },
          },
        ],
      },
    ])

    const body = await (await GET(req())).json()

    expect(body.posts).toHaveLength(1)
    const post = body.posts[0]
    expect(post.id).toBe('post-1')
    expect(post.results.respondents).toHaveLength(1)
    expect(post.results.respondents[0].user.name).toBe('Alice')
    expect(post.results.respondents[0].answer).toEqual(['Red'])
  })

  it('falls back to username when the respondent has no display name', async () => {
    authed({ id: 'me' })
    ;(db.bulletinPost.findMany as any).mockResolvedValue([
      {
        id: 'post-2',
        text: 'Pick one',
        createdAt: new Date('2026-01-05T00:00:00.000Z'),
        blocks: [pollBlock],
        responses: [
          {
            userId: 'u-2',
            responses: { 'el-1': { type: 'poll', answer: 'Blue' } },
            createdAt: new Date('2026-01-06T00:00:00.000Z'),
            user: { name: null, username: 'bobby', avatar: null },
          },
        ],
      },
    ])

    const body = await (await GET(req())).json()
    expect(body.posts[0].results.respondents[0].user.name).toBe('bobby')
  })

  it('500s and does not leak internals when the db throws', async () => {
    authed({ id: 'me' })
    ;(db.bulletinPost.findMany as any).mockRejectedValue(new Error('boom'))
    const res = await GET(req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: 'Failed to fetch bulletin analytics' })
  })
})
