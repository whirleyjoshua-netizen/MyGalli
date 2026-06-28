'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wand2 } from 'lucide-react'

export function ProfileCanvasBar({
  hasCanvas,
  profileDisplayId,
}: {
  hasCanvas: boolean
  profileDisplayId: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const go = async () => {
    if (hasCanvas && profileDisplayId) {
      router.push(`/editor?id=${profileDisplayId}`)
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/profile/canvas', { method: 'POST' })
      if (res.ok) {
        const { id } = await res.json()
        router.push(`/editor?id=${id}`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 flex items-center justify-between gap-4 p-4 rounded-2xl border border-dashed border-border bg-surface">
      <p className="text-sm text-muted-foreground">
        {hasCanvas
          ? 'Your custom profile canvas.'
          : 'Add a custom canvas to your profile — text, images, anything.'}
      </p>
      <button
        onClick={go}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-soft hover:brightness-105 transition-all disabled:opacity-50 cursor-pointer"
      >
        <Wand2 className="w-4 h-4" /> {hasCanvas ? 'Edit canvas' : 'Customize your profile'}
      </button>
    </div>
  )
}
