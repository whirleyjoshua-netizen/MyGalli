'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/store'

// Refresh the persisted auth user (notably `plan`) from the server on mount, so
// an account upgraded server-side reflects in the UI without a re-login. Merges
// over the existing store user to preserve fields the endpoint doesn't return
// (location, interests, links, etc.).
export function useRefreshUser() {
  const setAuth = useAuthStore((s) => s.setAuth)
  useEffect(() => {
    let active = true
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.user) {
          setAuth({ ...useAuthStore.getState().user, ...d.user })
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [setAuth])
}
