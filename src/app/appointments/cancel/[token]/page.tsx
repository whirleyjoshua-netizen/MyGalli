// src/app/appointments/cancel/[token]/page.tsx
'use client'
import { use, useState } from 'react'

export default function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const cancel = async () => {
    setState('loading')
    const res = await fetch(`/api/appointments/cancel/${token}`, { method: 'POST' })
    setState(res.ok ? 'done' : 'error')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-4 rounded-2xl border border-border p-8">
        {state === 'done' ? (
          <>
            <h1 className="text-xl font-bold text-foreground">Booking cancelled</h1>
            <p className="text-sm text-muted-foreground">Your appointment has been cancelled. A confirmation email is on its way.</p>
          </>
        ) : state === 'error' ? (
          <>
            <h1 className="text-xl font-bold text-foreground">Link expired</h1>
            <p className="text-sm text-muted-foreground">This booking may already be cancelled or the link is invalid.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-foreground">Cancel this booking?</h1>
            <p className="text-sm text-muted-foreground">This frees the time slot for others. This can't be undone.</p>
            <button onClick={cancel} disabled={state === 'loading'}
              className="w-full py-2.5 rounded-full bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50">
              {state === 'loading' ? 'Cancelling…' : 'Cancel booking'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
