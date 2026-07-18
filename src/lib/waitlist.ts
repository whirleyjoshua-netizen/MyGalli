/** Pure helpers for the Wait List element. No imports, no side effects. */

export function isFull(count: number, capacity: number | null | undefined): boolean {
  if (!capacity || capacity <= 0) return false
  return count >= capacity
}

export function spotsRemaining(count: number, capacity: number | null | undefined): number | null {
  if (!capacity || capacity <= 0) return null
  return Math.max(0, capacity - count)
}

export function progressPercent(count: number, capacity: number | null | undefined): number {
  if (!capacity || capacity <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((count / capacity) * 100)))
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function waitlistCountdownParts(
  launchDate: string | null | undefined,
  now: Date,
): { days: number; hours: number; minutes: number; isPast: boolean } | null {
  if (!launchDate) return null
  const target = new Date(launchDate).getTime()
  if (Number.isNaN(target)) return null
  const diff = target - now.getTime()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, isPast: true }
  return {
    days: Math.floor(diff / DAY),
    hours: Math.floor((diff % DAY) / HOUR),
    minutes: Math.floor((diff % HOUR) / MINUTE),
    isPast: false,
  }
}

export function collectElements(sections: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(sections)) return []
  const out: Array<Record<string, unknown>> = []
  for (const section of sections) {
    const columns = (section as { columns?: unknown })?.columns
    if (!Array.isArray(columns)) continue
    for (const column of columns) {
      const elements = (column as { elements?: unknown })?.elements
      if (!Array.isArray(elements)) continue
      for (const el of elements) {
        if (el && typeof el === 'object') out.push(el as Record<string, unknown>)
      }
    }
  }
  return out
}
