'use client'

import { useEffect, useRef, useState } from 'react'

export const FAILURE_THRESHOLD = 3
export const BACKOFF_MS = 30_000

/**
 * Calls `callback` on an interval, but only while the tab is visible. A hidden
 * tab costs nothing, which is what makes polling affordable in place of
 * sockets. After FAILURE_THRESHOLD consecutive failures the interval stretches
 * to BACKOFF_MS instead of hammering a server that is already unhappy.
 */
export function usePolling(
  callback: () => Promise<unknown>,
  { intervalMs, enabled = true }: { intervalMs: number; enabled?: boolean }
): { failures: number } {
  const [failures, setFailures] = useState(0)
  // Keeping the callback in a ref means a new closure each render does not
  // restart the interval.
  const cbRef = useRef(callback)
  cbRef.current = callback

  const failureRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    let timer: ReturnType<typeof setInterval> | undefined

    const run = async () => {
      try {
        await cbRef.current()
        if (failureRef.current !== 0) {
          failureRef.current = 0
          setFailures(0)
        }
      } catch {
        failureRef.current += 1
        setFailures(failureRef.current)
      }
    }

    const start = () => {
      if (timer) clearInterval(timer)
      const period = failureRef.current >= FAILURE_THRESHOLD ? BACKOFF_MS : intervalMs
      timer = setInterval(run, period)
    }

    const onVisibility = () => {
      if (document.hidden) {
        if (timer) clearInterval(timer)
        timer = undefined
      } else {
        void run()
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, enabled, failures >= FAILURE_THRESHOLD])

  return { failures }
}
