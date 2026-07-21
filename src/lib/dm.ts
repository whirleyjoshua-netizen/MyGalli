import type { DmParticipantState } from './types/dm'

export interface DmMessageLike {
  senderId: string
  createdAt: Date | string
}

/**
 * Stable identity for a 1:1 conversation. Sorting means the same pair always
 * produces the same key regardless of who starts, which lets a UNIQUE index
 * make duplicate conversations impossible even under a race.
 */
export function conversationKey(a: string, b: string): string {
  return [a, b].sort().join(':')
}

/** Messages from the other person newer than my read position. */
export function unreadCount(
  messages: DmMessageLike[],
  lastReadAt: Date | string | null,
  myId: string
): number {
  const floor = lastReadAt ? new Date(lastReadAt).getTime() : 0
  return messages.filter(
    (m) => m.senderId !== myId && new Date(m.createdAt).getTime() > floor
  ).length
}

/**
 * A stranger's first message lands in Requests; someone who already follows
 * you (or who you've already conversed with) goes straight to the inbox.
 */
export function initialParticipantState(f: {
  recipientFollowsSender: boolean
  hasAcceptedHistory: boolean
}): Extract<DmParticipantState, 'accepted' | 'requested'> {
  return f.recipientFollowsSender || f.hasAcceptedHistory ? 'accepted' : 'requested'
}

/** Local-time YYYY-MM-DD. Local, not UTC, so separators match the reader's day. */
export function dayKey(d: Date | string): string {
  const date = new Date(d)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${day}`
}

export function groupByDay<T extends { createdAt: Date | string }>(
  messages: T[]
): { key: string; items: T[] }[] {
  const out: { key: string; items: T[] }[] = []
  for (const m of messages) {
    const key = dayKey(m.createdAt)
    const last = out[out.length - 1]
    if (last && last.key === key) last.items.push(m)
    else out.push({ key, items: [m] })
  }
  return out
}

export function dayLabel(key: string, now: Date = new Date()): string {
  if (key === dayKey(now)) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (key === dayKey(yesterday)) return 'Yesterday'
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Presence is a heartbeat, not a socket: seen within this window reads as online. */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000

export function isOnline(
  lastSeenAt: Date | string | null | undefined,
  now: Date | number = Date.now()
): boolean {
  if (!lastSeenAt) return false
  const seen = new Date(lastSeenAt).getTime()
  if (Number.isNaN(seen)) return false
  const nowMs = typeof now === 'number' ? now : now.getTime()
  return nowMs - seen < ONLINE_WINDOW_MS
}
