import { describe, it, expect } from 'vitest'
import { getProfileActionCards } from './profile-actions'

describe('getProfileActionCards', () => {
  it('gives the owner Mailbox, Share, Edit', () => {
    expect(getProfileActionCards(true).map((c) => c.key)).toEqual(['mailbox', 'share', 'edit'])
  })

  it('gives a visitor Message, Share, Follow', () => {
    expect(getProfileActionCards(false).map((c) => c.key)).toEqual(['message', 'share', 'follow'])
  })
})
