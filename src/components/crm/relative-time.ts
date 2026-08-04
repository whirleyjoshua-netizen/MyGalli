import { timeAgo } from '@/lib/time-ago'

// timeAgo() returns bare units ('now', '5m', '3h'), so callers append " ago".
// That reads fine for every value except the under-a-minute case, which came
// out as "now ago" — visible on every note the moment it was added.
export function relativeTime(occurredAt: string | Date): string {
  const iso = occurredAt instanceof Date ? occurredAt.toISOString() : new Date(occurredAt).toISOString()
  const ago = timeAgo(iso)
  return ago === 'now' ? 'just now' : `${ago} ago`
}
