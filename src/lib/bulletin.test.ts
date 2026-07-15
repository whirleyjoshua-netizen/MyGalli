import { describe, it, expect } from 'vitest'
import { isBulletinBlockType, normalizeSettings, isEmptyPost, isInScope, resultsVisible, scoreTrending, rankTrending } from './bulletin'

describe('isBulletinBlockType', () => {
  it('accepts the three v1 types and rejects everything else', () => {
    expect(isBulletinBlockType('poll')).toBe(true)
    expect(isBulletinBlockType('rating')).toBe(true)
    expect(isBulletinBlockType('shortanswer')).toBe(true)
    expect(isBulletinBlockType('mcq')).toBe(false)
    expect(isBulletinBlockType('comment')).toBe(false)
    expect(isBulletinBlockType(null)).toBe(false)
  })
})

describe('normalizeSettings', () => {
  it('coerces to booleans and defaults to false', () => {
    expect(normalizeSettings({ revealAfterAnswer: true, liveTally: 1 })).toEqual({ revealAfterAnswer: true, liveTally: true })
    expect(normalizeSettings(null)).toEqual({ revealAfterAnswer: false, liveTally: false })
    expect(normalizeSettings('nope')).toEqual({ revealAfterAnswer: false, liveTally: false })
  })
})

describe('isEmptyPost', () => {
  it('is empty only when text, image, and block are all absent', () => {
    expect(isEmptyPost({})).toBe(true)
    expect(isEmptyPost({ text: '   ' })).toBe(true)
    expect(isEmptyPost({ text: 'hi' })).toBe(false)
    expect(isEmptyPost({ imageUrl: 'https://x/y.png' })).toBe(false)
    expect(isEmptyPost({ block: { id: 'b', type: 'poll' } })).toBe(false)
  })
})

describe('isInScope', () => {
  it('allows own posts and followed authors, rejects strangers', () => {
    expect(isInScope('me', ['a', 'b'], 'me')).toBe(true)
    expect(isInScope('a', ['a', 'b'], 'me')).toBe(true)
    expect(isInScope('stranger', ['a', 'b'], 'me')).toBe(false)
  })
})

describe('resultsVisible', () => {
  it('author always sees; otherwise gated by reveal + hasResponded', () => {
    expect(resultsVisible({ isAuthor: true, revealAfterAnswer: true, hasResponded: false })).toBe(true)
    expect(resultsVisible({ isAuthor: false, revealAfterAnswer: false, hasResponded: false })).toBe(true)
    expect(resultsVisible({ isAuthor: false, revealAfterAnswer: true, hasResponded: false })).toBe(false)
    expect(resultsVisible({ isAuthor: false, revealAfterAnswer: true, hasResponded: true })).toBe(true)
  })
})

describe('scoreTrending', () => {
  it('weights responses 2x likes', () => {
    expect(scoreTrending(0, 0)).toBe(0)
    expect(scoreTrending(3, 0)).toBe(3)
    expect(scoreTrending(0, 2)).toBe(4)
    expect(scoreTrending(1, 5)).toBe(11)
  })
})

describe('rankTrending', () => {
  const d = (n: number) => new Date(2026, 0, n)
  const items = [
    { id: 'a', likeCount: 10, responseCount: 0, createdAt: d(1) }, // score 10
    { id: 'b', likeCount: 0, responseCount: 6, createdAt: d(2) },  // score 12
    { id: 'c', likeCount: 2, responseCount: 2, createdAt: d(3) },  // score 6
    { id: 'd', likeCount: 2, responseCount: 2, createdAt: d(4) },  // score 6, newer than c
  ]
  it('orders by score desc then createdAt desc, and reports total', () => {
    const { pageItems, total } = rankTrending(items, 1, 10)
    expect(pageItems.map((i) => i.id)).toEqual(['b', 'a', 'd', 'c'])
    expect(total).toBe(4)
  })
  it('paginates the ranked list', () => {
    expect(rankTrending(items, 1, 2).pageItems.map((i) => i.id)).toEqual(['b', 'a'])
    expect(rankTrending(items, 2, 2).pageItems.map((i) => i.id)).toEqual(['d', 'c'])
    expect(rankTrending(items, 3, 2).pageItems).toEqual([])
  })
})

import { firstBlock } from './bulletin'

describe('firstBlock', () => {
  it('returns the single block from a blocks array', () => {
    const b = { id: 'b1', type: 'poll' }
    expect(firstBlock([b])).toEqual(b)
  })
  it('returns null for an empty array', () => {
    expect(firstBlock([])).toBeNull()
  })
  it('returns null for a non-array (null, undefined, object, string)', () => {
    expect(firstBlock(null)).toBeNull()
    expect(firstBlock(undefined)).toBeNull()
    expect(firstBlock({})).toBeNull()
    expect(firstBlock('nope')).toBeNull()
  })
  it('ignores extra blocks — v1 allows at most one', () => {
    expect(firstBlock([{ id: 'a' }, { id: 'b' }])).toEqual({ id: 'a' })
  })
})
