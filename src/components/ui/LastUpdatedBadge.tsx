import { formatLastUpdated, absoluteLastUpdated } from '@/lib/last-updated'

/**
 * Public "last updated" stamp. Server-rendered: the public page is dynamic
 * (it reads the auth cookie), so the relative time is computed per request and
 * cannot go stale. There is no client render, so no hydration mismatch.
 *
 * Owns no layout — callers place it.
 */
export function LastUpdatedBadge({ date }: { date: Date }) {
  return (
    <time
      dateTime={date.toISOString()}
      title={absoluteLastUpdated(date)}
      className="text-sm opacity-50"
    >
      Updated {formatLastUpdated(date, new Date())}
    </time>
  )
}
