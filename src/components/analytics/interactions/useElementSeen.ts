'use client'

import { useCallback, useState } from 'react'

// Per-device, per-browser record of when the owner last opened each element.
// Deliberately localStorage rather than a table: it needs no migration, and
// "what have I already looked at" is a device-local question.
export const SEEN_STORAGE_KEY = 'galli_element_seen'

export type SeenMap = Record<string, string>

export function readSeen(): SeenMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as SeenMap) : {}
  } catch {
    return {}
  }
}

export function markSeen(key: string, at: Date = new Date()): SeenMap {
  const next = { ...readSeen(), [key]: at.toISOString() }
  try {
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private mode or quota — the grid still works, statuses just won't persist.
  }
  return next
}

export function useElementSeen() {
  const [seen, setSeen] = useState<SeenMap>(() => readSeen())
  const mark = useCallback((key: string) => setSeen(markSeen(key)), [])
  return { seen, markSeen: mark }
}
