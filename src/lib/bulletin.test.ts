import { describe, it, expect } from 'vitest'
import { isBulletinBlockType, normalizeSettings, isEmptyPost, isInScope, resultsVisible } from './bulletin'

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
