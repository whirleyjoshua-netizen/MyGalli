'use client'

import { useEffect, useRef, useState } from 'react'
import { buildHubPayloadKey } from '@/lib/hub-config'

export function useHubAutosave({
  hubId, payload, version, enabled = true, delay = 900,
}: {
  hubId: string
  payload: Record<string, unknown>
  version: number
  enabled?: boolean
  delay?: number
}) {
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [conflict, setConflict] = useState(false)
  const [dirty, setDirty] = useState(false)
  const versionRef = useRef(version)
  const lastKeyRef = useRef<string | null>(buildHubPayloadKey(payload))

  useEffect(() => { versionRef.current = version }, [version])

  const key = buildHubPayloadKey(payload)
  useEffect(() => {
    if (!enabled || conflict) return
    if (key === lastKeyRef.current) return
    setDirty(true)
    const t = setTimeout(async () => {
      setSaving(true)
      try {
        const res = await fetch(`/api/hubs/${hubId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, version: versionRef.current }),
        })
        if (res.status === 409) { setConflict(true); return }
        if (res.ok) {
          lastKeyRef.current = key
          const updated = await res.json().catch(() => ({}))
          if (updated && typeof updated === 'object' && typeof (updated as { version?: unknown }).version === 'number') {
            versionRef.current = (updated as { version: number }).version
          }
          setLastSaved(new Date())
          setDirty(false)
        }
      } catch {
        /* keep dirty; will retry on next change */
      } finally {
        setSaving(false)
      }
    }, delay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, conflict, hubId, delay])

  return { saving, lastSaved, conflict, dirty }
}
