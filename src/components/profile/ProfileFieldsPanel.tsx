'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, ImageIcon, X } from 'lucide-react'
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
  const [location, setLocation] = useState(user.location || '')
  const [bio, setBio] = useState(user.bio || '')
  const [avatar, setAvatar] = useState<string | null>(user.avatar || null)
  const [interests, setInterests] = useState<string[]>(user.interests || [])
  const [interestDraft, setInterestDraft] = useState('')
  const [links, setLinks] = useState<{ label: string; url: string }[]>(user.links || [])

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
          body: JSON.stringify({
            name,
            location,
            bio,
            avatar,
            interests,
            links: links.filter((l) => l.label.trim() && l.url.trim()),
          }),
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
  }, [name, location, bio, avatar, interests, links])

  const addInterest = () => {
    const t = interestDraft.trim()
    if (t && !interests.includes(t) && interests.length < 12) setInterests([...interests, t])
    setInterestDraft('')
  }

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

      <div>
        <label className="block text-sm font-medium mb-1.5">Name</label>
        <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Location / role</label>
        <input aria-label="Location / role" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. QB · Westfield High · Class 2026" className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Bio</label>
        <textarea aria-label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
      </div>

      {/* Interests */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Interests</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {interests.map((it) => (
            <span key={it} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
              {it}
              <button onClick={() => setInterests(interests.filter((x) => x !== it))} className="text-muted-foreground hover:text-destructive cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <input
          aria-label="Add interest"
          value={interestDraft}
          onChange={(e) => setInterestDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addInterest()
            }
          }}
          placeholder="Type and press Enter (max 12)"
          className={inputCls}
        />
      </div>

      {/* Links */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Links</label>
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label={`Link ${i + 1} label`} value={l.label} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Label" className={`${inputCls} w-1/3`} />
              <input aria-label={`Link ${i + 1} url`} value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://…" className={`${inputCls} flex-1`} />
              <button onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label="Remove link" className="p-2 text-muted-foreground hover:text-destructive cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        {links.length < 10 && (
          <button onClick={() => setLinks([...links, { label: '', url: '' }])} className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline cursor-pointer">
            <Plus className="w-4 h-4" /> Add link
          </button>
        )}
      </div>
    </div>
  )
}
