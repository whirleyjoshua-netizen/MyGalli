'use client'

import { useState } from 'react'
import { X, ImageIcon, Check, Trophy, Palette, Briefcase, Store, User, PartyPopper, GraduationCap, Sparkles } from 'lucide-react'
import { CATEGORIES } from '@/lib/categories'

const ICONS: Record<string, typeof Trophy> = {
  Trophy, Palette, Briefcase, Store, User, PartyPopper, GraduationCap, Sparkles,
}

export function PublishDialog({
  isOpen,
  onClose,
  displayId,
  currentCategory,
  currentCover,
  onPublished,
}: {
  isOpen: boolean
  onClose: () => void
  displayId: string
  currentCategory: string | null
  currentCover: string | null
  onPublished: (category: string, coverImage: string | null) => void
}) {
  const [category, setCategory] = useState<string | null>(currentCategory)
  const [cover, setCover] = useState<string | null>(currentCover)
  const [busy, setBusy] = useState(false)

  if (!isOpen) return null

  const uploadCover = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (res.ok) setCover((await res.json()).url)
  }

  const publish = async () => {
    if (!category || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/displays/${displayId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: true, category, coverImage: cover }),
      })
      if (res.ok) {
        onPublished(category, cover)
        onClose()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto bg-surface border border-border rounded-2xl shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface">
          <h2 className="font-bold">Publish to Explore</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Category (required) */}
          <div>
            <p className="text-sm font-medium mb-2">Pick a category <span className="text-destructive">*</span></p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map((c) => {
                const Icon = ICONS[c.icon] ?? Sparkles
                const active = category === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                      active ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-primary' : ''}`} />
                    <span className="text-[11px] font-medium leading-tight">{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cover (encouraged) */}
          <div>
            <p className="text-sm font-medium mb-2">Cover image <span className="text-muted-foreground font-normal">(recommended)</span></p>
            <div className="flex items-center gap-3">
              <div className={`w-28 h-16 rounded-xl overflow-hidden shrink-0 ${cover ? '' : 'bg-gradient-to-br from-galli/20 to-galli-violet/20 flex items-center justify-center'}`}>
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <label className="text-sm font-medium text-primary cursor-pointer hover:underline">
                {cover ? 'Change cover' : 'Upload cover'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = '' }} />
              </label>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-surface">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-accent transition-colors cursor-pointer">Cancel</button>
          <button onClick={publish} disabled={!category || busy} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-soft hover:brightness-105 transition-all disabled:opacity-50 cursor-pointer">
            <Check className="w-4 h-4" /> {busy ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}
