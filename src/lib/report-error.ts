// Central error-reporting seam. Today it writes a structured console.error;
// when an error-tracking SDK (e.g. Sentry) is added, forward to it from HERE —
// one place to wire it up, and every error boundary already calls this.
export function reportError(error: unknown, context?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(String(error))
  console.error('[error]', {
    message: err.message,
    stack: err.stack,
    ...context,
  })
  // TODO: when SENTRY_DSN is configured, forward here, e.g.
  //   Sentry.captureException(err, { extra: context })
}
