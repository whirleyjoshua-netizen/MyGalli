'use client'

import { useState, useEffect, useRef } from 'react'
import { ImageIcon, ImagePlus } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import type { User } from '@/lib/types'

const inputCls =
  'w-full px-3 py-2 border border-border rounded-xl bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition'

// `user` provides INITIAL field values only — this component is mounted fresh
// per /profile/edit page load, so it intentionally does not react to later
// `user` prop changes (matches the prior EditProfileModal behavior).
export function ProfileFieldsPanel({
  user,
  onSavingChange,
}: {
  user: User
  onSavingChange: (saving: boolean) => void
}) {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [name, setName] = useState(user.name || '')
  const [bio, setBio] = useState(user.bio || '')
  const [avatar, setAvatar] = useState<string | null>(user.avatar || null)
  const [coverImage, setCoverImage] = useState<string | null>(user.coverImage || null)

  const firstRender = useRef(true)

  // Debounced autosave whenever any field changes
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const t = setTimeout(async () => {
      onSavingChange(true)
      try {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, bio, avatar, coverImage }),
        })
        if (res.ok) {
          const updated = await res.json()
          setAuth({ ...user, ...updated })
        }
      } finally {
        onSavingChange(false)
      }
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, bio, avatar, coverImage])

  const uploadAvatar = async (file: File) => {
    onSavingChange(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) setAvatar((await res.json()).url)
    } finally {
      onSavingChange(false)
    }
  }

  const uploadCover = async (file: File) => {
    onSavingChange(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) setCoverImage((await res.json()).url)
    } finally {
      onSavingChange(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
      <h2 className="font-bold">Profile details</h2>

      {/* Avatar */}
      <div className="flex items-center gap-3">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="w-16 h-16 rounded-2xl object-cover" />
        ) : (
          <span className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
            <ImageIcon className="w-6 h-6" />
          </span>
        )}
        <label className="text-sm font-medium text-primary cursor-pointer hover:underline">
          Change photo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadAvatar(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {/* Cover */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Cover image</label>
        <div className="relative h-28 w-full rounded-xl overflow-hidden bg-galli-gradient">
          {coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <label className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-surface/85 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-galli-dark cursor-pointer hover:bg-surface transition">
            <ImagePlus className="w-4 h-4" /> Change cover
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadCover(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Name</label>
        <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Bio</label>
        <textarea aria-label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
      </div>
    </div>
  )
}
