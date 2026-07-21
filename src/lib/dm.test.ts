import { describe, it, expect } from 'vitest'
import {
  conversationKey,
  unreadCount,
  initialParticipantState,
  dayKey,
  groupByDay,
  dayLabel,
  isOnline,
  ONLINE_WINDOW_MS,
} from './dm'

describe('conversationKey', () => {
  it('is stable regardless of argument order', () => {
    expect(conversationKey('userB', 'userA')).toBe(conversationKey('userA', 'userB'))
  })
  it('joins the sorted ids with a colon', () => {
    expect(conversationKey('a', 'b')).toBe('a:b')
  })
})

describe('unreadCount', () => {
  const msgs = [
    { id: '1', senderId: 'them', createdAt: '2026-07-20T10:00:00.000Z' },
    { id: '2', senderId: 'me', createdAt: '2026-07-20T11:00:00.000Z' },
    { id: '3', senderId: 'them', createdAt: '2026-07-20T12:00:00.000Z' },
  ]
  it('counts only messages from the other person after lastReadAt', () => {
    expect(unreadCount(msgs, '2026-07-20T10:30:00.000Z', 'me')).toBe(1)
  })
  it('never counts my own messages', () => {
    expect(unreadCount(msgs, null, 'me')).toBe(2)
  })
  it('treats a null lastReadAt as never read', () => {
    expect(unreadCount(msgs, null, 'them')).toBe(1)
  })
  it('returns 0 when everything is already read', () => {
    expect(unreadCount(msgs, '2026-07-20T23:00:00.000Z', 'me')).toBe(0)
  })
})

describe('initialParticipantState', () => {
  it('accepts when the recipient already follows the sender', () => {
    expect(initialParticipantState({ recipientFollowsSender: true, hasAcceptedHistory: false })).toBe('accepted')
  })
  it('accepts when an accepted conversation already exists', () => {
    expect(initialParticipantState({ recipientFollowsSender: false, hasAcceptedHistory: true })).toBe('accepted')
  })
  it('requests for a total stranger', () => {
    expect(initialParticipantState({ recipientFollowsSender: false, hasAcceptedHistory: false })).toBe('requested')
  })
})

describe('groupByDay', () => {
  it('groups consecutive messages from the same local day', () => {
    const groups = groupByDay([
      { createdAt: new Date(2026, 6, 20, 9, 0) },
      { createdAt: new Date(2026, 6, 20, 23, 59) },
      { createdAt: new Date(2026, 6, 21, 0, 1) },
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].items).toHaveLength(2)
    expect(groups[1].items).toHaveLength(1)
  })
  it('returns an empty array for no messages', () => {
    expect(groupByDay([])).toEqual([])
  })
})

describe('dayLabel', () => {
  const now = new Date(2026, 6, 20, 12, 0)
  it('labels today', () => {
    expect(dayLabel(dayKey(now), now)).toBe('Today')
  })
  it('labels yesterday', () => {
    expect(dayLabel(dayKey(new Date(2026, 6, 19)), now)).toBe('Yesterday')
  })
  it('falls back to a date for anything older', () => {
    expect(dayLabel(dayKey(new Date(2026, 6, 1)), now)).not.toMatch(/Today|Yesterday/)
  })
})

describe('isOnline', () => {
  const now = new Date('2026-07-20T12:00:00.000Z').getTime()
  it('is online just inside the window', () => {
    expect(isOnline(new Date(now - ONLINE_WINDOW_MS + 1000), now)).toBe(true)
  })
  it('is offline just outside the window', () => {
    expect(isOnline(new Date(now - ONLINE_WINDOW_MS - 1000), now)).toBe(false)
  })
  it('is offline for null', () => {
    expect(isOnline(null, now)).toBe(false)
  })
  it('is offline for an unparseable value', () => {
    expect(isOnline('not-a-date', now)).toBe(false)
  })
})
