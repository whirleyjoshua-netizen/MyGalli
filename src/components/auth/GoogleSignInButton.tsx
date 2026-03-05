'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void
        }
      }
    }
  }
}

interface Props {
  mode: 'login' | 'signup'
}

export function GoogleSignInButton({ mode }: Props) {
  const router = useRouter()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  const handleCredentialResponse = useCallback(async (response: { credential: string }) => {
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: response.credential }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Google sign-in failed')
        return
      }

      setAuth(data.user)
      router.push('/dashboard')
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [router, setAuth])

  useEffect(() => {
    if (!clientId) return

    // Load Google Identity Services script
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
      })

      const buttonEl = document.getElementById('google-signin-button')
      if (buttonEl) {
        window.google?.accounts.id.renderButton(buttonEl, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: mode === 'login' ? 'signin_with' : 'signup_with',
          shape: 'pill',
        })
      }
    }

    document.head.appendChild(script)
    return () => { script.remove() }
  }, [clientId, mode, handleCredentialResponse])

  if (!clientId) return null

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl">
          {error}
        </div>
      )}

      <div
        id="google-signin-button"
        className={`flex justify-center ${loading ? 'opacity-50 pointer-events-none' : ''}`}
      />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>
    </div>
  )
}
