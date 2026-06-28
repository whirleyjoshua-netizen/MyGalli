'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'

export default function ForgotPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-[480px] h-[480px] bg-galli/10 rounded-full blur-3xl -z-10" />
      <div className="absolute -bottom-40 -left-40 w-[480px] h-[480px] bg-galli-violet/10 rounded-full blur-3xl -z-10" />
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Wordmark className="text-3xl mb-3" />
          <h1 className="text-2xl font-bold text-center">Reset your password</h1>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6 shadow-soft">
          {sent ? (
            <div className="text-center py-4">
              <MailCheck className="w-12 h-12 text-primary mx-auto mb-4" />
              <p className="text-foreground font-medium mb-1">Check your inbox</p>
              <p className="text-sm text-muted-foreground">If an account exists for that email, we&apos;ve sent a reset link.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-full font-semibold shadow-soft hover:brightness-105 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remembered it?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  )
}
