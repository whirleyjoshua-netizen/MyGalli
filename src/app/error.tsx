'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { reportError } from '@/lib/report-error'

// Route-level error boundary: catches render/runtime errors in a route segment,
// reports them, and shows a recoverable, branded message.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportError(error, { digest: error.digest })
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred on our end. You can try again, or head back home.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold transition hover:bg-muted"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
