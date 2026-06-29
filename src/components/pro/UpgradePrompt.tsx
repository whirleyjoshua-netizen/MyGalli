'use client'

import Link from 'next/link'
import { X, Sparkles } from 'lucide-react'

export function UpgradePrompt({
  isOpen,
  onClose,
  feature = 'This feature',
}: {
  isOpen: boolean
  onClose: () => void
  feature?: string
}) {
  if (!isOpen) return null
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-soft-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-galli-violet/15">
            <Sparkles className="h-6 w-6 text-galli-violet" />
          </div>
          <h3 className="text-lg font-bold">Upgrade to Pro</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {feature} is part of My Galli Pro. Upgrade to unlock it.
          </p>
          <Link
            href="/enterprise"
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            See Pro
          </Link>
        </div>
      </div>
    </>
  )
}
