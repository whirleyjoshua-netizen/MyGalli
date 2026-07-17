import { describe, it, expect } from 'vitest'
import { HUB_REACTION_EMOJI, isHubReactionEmoji, summarizeReactions } from './hub-reactions'

describe('hub-reactions', () => {
  it('exposes the curated emoji set', () => {
    expect(HUB_REACTION_EMOJI).toEqual(['❤️', '👍', '😂', '🎉', '😮', '😢'])
  })
  it('validates emoji membership', () => {
    expect(isHubReactionEmoji('❤️')).toBe(true)
    expect(isHubReactionEmoji('🐸')).toBe(false)
    expect(isHubReactionEmoji(42)).toBe(false)
  })
  it('summarizes counts and the viewer\'s own reactions', () => {
    const rows = [
      { emoji: '❤️', userId: 'a' },
      { emoji: '❤️', userId: 'b' },
      { emoji: '👍', userId: 'a' },
    ]
    expect(summarizeReactions(rows, 'a')).toEqual({ counts: { '❤️': 2, '👍': 1 }, mine: ['❤️', '👍'] })
    expect(summarizeReactions(rows).mine).toEqual([])
  })
})
