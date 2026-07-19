'use client'

import { useState } from 'react'
import { Settings } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { PageHero } from '@/components/dashboard/PageHero'
import type { User } from '@/lib/types'

export default function SettingsPage() {
  const { user, setAuth } = useAuthStore()
  const [name, setName] = useState(user?.name || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [avatar, setAvatar] = useState(user?.avatar || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!user) return null
  const initial = (name || user.username || '?').charAt(0).toUpperCase()

  const onUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/upload', { method: 'POST', body: fd })
      if (r.ok) setAvatar((await r.json()).url)
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const r = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, bio, avatar }),
      })
      if (r.ok) {
        const updated = await r.json()
        setAuth({ ...user, ...updated } as User)
        setSaved(true)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pb-7">
      <PageHero icon={<Settings className="w-7 h-7 text-primary" />} title="Settings" />
      <div className="px-6 lg:px-8 max-w-xl">
      <div className="space-y-5">
        <div>
          <span className="block text-sm font-medium mb-2">Profile photo</span>
          <div className="flex items-center gap-4">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="w-16 h-16 rounded-2xl object-cover" />
            ) : (
              <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-galli/30 to-galli-violet/30 text-galli-dark font-bold text-xl flex items-center justify-center">
                {initial}
              </span>
            )}
            <label className="px-3 py-2 rounded-lg border border-border text-sm font-medium cursor-pointer hover:bg-muted transition">
              {uploading ? 'Uploading…' : 'Change photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }}
              />
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="s-name" className="block text-sm font-medium mb-1.5">Display name</label>
          <input id="s-name" aria-label="Display name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>

        <div>
          <label htmlFor="s-bio" className="block text-sm font-medium mb-1.5">Bio</label>
          <textarea id="s-bio" aria-label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" />
        </div>

        <div>
          <label htmlFor="s-email" className="block text-sm font-medium mb-1.5">Email</label>
          <input id="s-email" aria-label="Email" value={user.email} readOnly
            className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-sm text-muted-foreground" />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-60">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="text-sm text-green-600">Saved ✓</span>}
        </div>
      </div>
      </div>
    </div>
  )
}
