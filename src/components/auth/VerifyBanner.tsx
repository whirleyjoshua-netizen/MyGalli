'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { MailWarning } from 'lucide-react'

export function VerifyBanner() {
  const { user } = useAuthStore()
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!user || user.emailVerified) return null

  const resend = async () => {
    setBusy(true)
    try {
      await fetch('/api/auth/resend-verification', { method: 'POST' })
      setSent(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm">
      <MailWarning className="w-4 h-4 shrink-0" />
      <span className="flex-1">Verify your email to secure your account.</span>
      {sent ? (
        <span className="text-amber-700 font-medium">Sent — check your inbox</span>
      ) : (
        <button onClick={resend} disabled={busy} className="font-semibold underline hover:no-underline disabled:opacity-50 cursor-pointer">
          Resend email
        </button>
      )}
    </div>
  )
}
