'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus, Trash2, ImageIcon } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import type { User } from '@/lib/types'

export function EditProfileModal({
  isOpen,
  onClose,
  user,
}: {
  isOpen: boolean
  onClose: () => void
  user: User
}) {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [name, setName] = useState(user.name || '')
  const [location, setLocation] = useState(user.location || '')
  const [bio, setBio] = useState(user.bio || '')
  const [avatar, setAvatar] = useState<string | null>(user.avatar || null)
  const [interests, setInterests] = useState<string[]>(user.interests || [])
  const [interestDraft, setInterestDraft] = useState('')
  const [links, setLinks] = useState<{ label: string; url: string }[]>(user.links || [])
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  const addInterest = () => {
    const t = interestDraft.trim()
    if (t && !interests.includes(t) && interests.length < 12) setInterests([...interests, t])
    setInterestDraft('')
  }

  const uploadAvatar = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (res.ok) setAvatar((await res.json()).url)
  }

  const save = async () => {
    setSaving(true)
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
        router.refresh()
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-border rounded-xl bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto bg-surface border border-border rounded-2xl shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface">
          <h2 className="font-bold">Edit profile</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-3">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="w-16 h-16 rounded-2xl object-cover" />
            ) : (
              <span className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground"><ImageIcon className="w-6 h-6" /></span>
            )}
            <label className="text-sm font-medium text-primary cursor-pointer hover:underline">
              Change photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = '' }} />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Location / role</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. QB · Westfield High · Class 2026" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
          </div>

          {/* Interests */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Interests</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {interests.map((it) => (
                <span key={it} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                  {it}
                  <button onClick={() => setInterests(interests.filter((x) => x !== it))} className="text-muted-foreground hover:text-destructive cursor-pointer"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <input
              value={interestDraft}
              onChange={(e) => setInterestDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest() } }}
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
                  <input value={l.label} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Label" className={`${inputCls} w-1/3`} />
                  <input value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://…" className={`${inputCls} flex-1`} />
                  <button onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label="Remove link" className="p-2 text-muted-foreground hover:text-destructive cursor-pointer"><Trash2 className="w-4 h-4" /></button>
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

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-surface">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-accent transition-colors cursor-pointer">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-soft hover:brightness-105 transition-all disabled:opacity-50 cursor-pointer">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}
