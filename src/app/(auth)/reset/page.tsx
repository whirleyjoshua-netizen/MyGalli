'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'

function ResetInner() {
  const token = useSearchParams().get('token')
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (!token) {
      setError('Invalid reset link')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not reset password')
        return
      }
      setDone(true)
      setTimeout(() => router.push('/login'), 1500)
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8 shadow-soft text-center">
        <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-1">Password updated</h1>
        <p className="text-muted-foreground">Redirecting you to log in…</p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-soft">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-xl">{error}</div>}
        <div>
          <label className="block text-sm font-medium mb-1.5">New password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required
            className="w-full px-4 py-2.5 border border-border rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Confirm password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required
            className="w-full px-4 py-2.5 border border-border rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-full font-semibold shadow-soft hover:brightness-105 transition-all disabled:opacity-50 cursor-pointer">
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}

export default function ResetPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-[480px] h-[480px] bg-galli/10 rounded-full blur-3xl -z-10" />
      <div className="absolute -bottom-40 -left-40 w-[480px] h-[480px] bg-galli-violet/10 rounded-full blur-3xl -z-10" />
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Wordmark className="text-3xl mb-3" />
          <h1 className="text-2xl font-bold text-center">Choose a new password</h1>
        </div>
        <Suspense fallback={<div className="bg-surface border border-border rounded-2xl p-8 shadow-soft text-center text-muted-foreground">Loading…</div>}>
          <ResetInner />
        </Suspense>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary font-medium hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  )
}
