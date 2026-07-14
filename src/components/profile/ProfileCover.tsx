'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus } from 'lucide-react'

export function ProfileCover({
  coverImage,
  isOwner,
}: {
  coverImage: string | null
  isOwner: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const up = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!up.ok) return
      const { url } = await up.json()
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverImage: url }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative h-44 sm:h-56 w-full rounded-b-3xl overflow-hidden bg-galli-gradient">
      {coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {isOwner && (
        <label className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-surface/85 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-galli-dark cursor-pointer hover:bg-surface transition">
          <ImagePlus className="w-4 h-4" />
          {busy ? 'Uploading…' : 'Change cover'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f)
              e.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}
