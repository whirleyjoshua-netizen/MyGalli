/**
 * Formatting for the public "last updated" indicator.
 *
 * Deliberately separate from `time-ago.ts`: that one is tuned for bulletin
 * posts, renders compact forms ("3d"), and caps at days — a year-old page would
 * read "412d ago". This module renders prose and graduates to an absolute date.
 *
 * `now` is injected rather than read from the clock so tests are deterministic.
 * All dates are formatted in UTC so output does not vary with server timezone.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`
}

export function formatLastUpdated(date: Date, now: Date): string {
  const elapsed = now.getTime() - date.getTime()

  // Also catches negative elapsed (clock skew) — never render "in 3 hours".
  if (elapsed < MINUTE) return 'just now'

  const minutes = Math.floor(elapsed / MINUTE)
  if (minutes < 60) return plural(minutes, 'minute')

  const hours = Math.floor(elapsed / HOUR)
  if (hours < 24) return plural(hours, 'hour')

  const days = Math.floor(elapsed / DAY)
  if (days < 7) return plural(days, 'day')
  if (days < 30) return plural(Math.floor(days / 7), 'week')
  if (days < 365) return plural(Math.floor(days / 30), 'month')

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function absoluteLastUpdated(date: Date): string {
  return date.toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'UTC' })
}
