'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'

function VerifyInner() {
  const token = useSearchParams().get('token')
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading')

  useEffect(() => {
    if (!token) {
      setState('fail')
      return
    }
    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((r) => setState(r.ok ? 'ok' : 'fail'))
      .catch(() => setState('fail'))
  }, [token])

  return (
    <div className="bg-surface border border-border rounded-2xl p-8 shadow-soft text-center">
      {state === 'loading' && (
        <>
          <Loader2 className="w-10 h-10 text-primary mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Verifying your email…</p>
        </>
      )}
      {state === 'ok' && (
        <>
          <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-1">Email verified</h1>
          <p className="text-muted-foreground mb-6">Your account is all set.</p>
          <Link href="/dashboard" className="inline-block px-6 py-2.5 bg-primary text-primary-foreground rounded-full font-semibold shadow-soft hover:brightness-105 transition-all cursor-pointer">
            Go to dashboard
          </Link>
        </>
      )}
      {state === 'fail' && (
        <>
          <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-1">Link invalid or expired</h1>
          <p className="text-muted-foreground mb-6">Request a fresh verification email from your dashboard.</p>
          <Link href="/login" className="inline-block px-6 py-2.5 bg-muted text-foreground rounded-full font-semibold hover:bg-accent transition-colors cursor-pointer">
            Back to login
          </Link>
        </>
      )}
    </div>
  )
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-[480px] h-[480px] bg-galli/10 rounded-full blur-3xl -z-10" />
      <div className="absolute -bottom-40 -left-40 w-[480px] h-[480px] bg-galli-violet/10 rounded-full blur-3xl -z-10" />
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Wordmark className="text-3xl" />
        </div>
        <Suspense fallback={<div className="bg-surface border border-border rounded-2xl p-8 shadow-soft text-center text-muted-foreground">Loading…</div>}>
          <VerifyInner />
        </Suspense>
      </div>
    </div>
  )
}
