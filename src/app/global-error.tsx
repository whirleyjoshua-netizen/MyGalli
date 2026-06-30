'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/report-error'

// Top-level error boundary: catches errors in the root layout itself. It replaces
// the whole document, so it must render its own <html>/<body> and can't rely on
// app styles/Tailwind — inline styles only.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportError(error, { digest: error.digest, scope: 'global' })
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '24px',
          fontFamily: 'system-ui, sans-serif',
          color: '#0f172a',
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Something went wrong</h1>
        <p style={{ marginTop: 8, color: '#64748b', maxWidth: 420 }}>
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 24,
            padding: '12px 24px',
            borderRadius: 9999,
            background: '#0f172a',
            color: 'white',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
