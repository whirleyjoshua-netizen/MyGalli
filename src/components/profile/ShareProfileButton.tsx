'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

export function ShareProfileButton({ username }: { username: string }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    try {
      await navigator.clipboard.writeText(`${origin}/${username}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* noop */
    }
  }

  return (
    <button
      onClick={share}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
    >
      {copied ? <Check className="w-4 h-4 text-primary" /> : <Share2 className="w-4 h-4" />}
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}
