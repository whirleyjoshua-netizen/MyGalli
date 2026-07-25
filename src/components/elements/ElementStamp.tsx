import { isValidTimeZone } from '@/lib/element-stamp'

/**
 * One muted line beneath a stamped element.
 *
 * Formatting is pinned to the AUTHOR's zone, not the viewer's, so the stamp
 * reads identically for everyone — otherwise a 7:30 PM New York stamp would
 * show as the next day's date in London.
 *
 * No hooks and no locale inference: this renders inside server-rendered public
 * pages, so server and client output must match exactly or React reports a
 * hydration mismatch.
 */
export function ElementStamp({
  stampedAt,
  stampedTz,
}: {
  stampedAt: string
  stampedTz?: string
}) {
  const date = new Date(stampedAt)
  if (Number.isNaN(date.getTime())) return null

  const timeZone = isValidTimeZone(stampedTz) ? stampedTz : 'UTC'
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)

  return (
    <time
      dateTime={stampedAt}
      className="mt-1.5 block text-xs text-muted-foreground"
    >
      {formatted.replace(' at ', ' · ')}
    </time>
  )
}
