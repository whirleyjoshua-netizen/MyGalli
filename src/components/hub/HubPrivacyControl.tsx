'use client'

import { useState } from 'react'
import { Lock, Globe } from 'lucide-react'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'

export interface PrivacyApply {
  visibility: 'public' | 'private'
  passcode?: string | null
}

interface HubPrivacyControlProps {
  visibility?: string | null
  hasPasscode?: boolean
  isPro: boolean
  onApply: (data: PrivacyApply) => Promise<void>
  /** What is being made private, e.g. "folder" or "item" — used in the upgrade prompt copy. */
  label?: string
}

/**
 * A compact Public/Private + passcode control for a single Hub folder or item.
 * Non-Pro owners see the UpgradePrompt instead of applying (the API also 403s).
 */
export function HubPrivacyControl({
  visibility,
  hasPasscode,
  isPro,
  onApply,
  label = 'Privacy',
}: HubPrivacyControlProps) {
  const [open, setOpen] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [draftPrivate, setDraftPrivate] = useState(visibility === 'private')
  const [passcode, setPasscode] = useState('')
  const [removePasscode, setRemovePasscode] = useState(false)
  const [saving, setSaving] = useState(false)

  const isPrivate = visibility === 'private'

  const toggle = () => {
    if (!open) {
      // Sync draft state to current values whenever the panel opens.
      setDraftPrivate(isPrivate)
      setPasscode('')
      setRemovePasscode(false)
    }
    setOpen((v) => !v)
  }

  const apply = async () => {
    if (!isPro) {
      setShowUpgrade(true)
      return
    }
    setSaving(true)
    try {
      const data: PrivacyApply = { visibility: draftPrivate ? 'private' : 'public' }
      if (!draftPrivate) {
        // A public node keeps no passcode.
        data.passcode = null
      } else if (removePasscode) {
        data.passcode = null
      } else if (passcode) {
        data.passcode = passcode
      }
      await onApply(data)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        title={isPrivate ? 'Private' : 'Public'}
        aria-label="Privacy settings"
        className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${
          isPrivate ? 'text-galli-violet' : 'text-muted-foreground'
        }`}
      >
        {isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-border bg-surface p-3 shadow-soft-lg space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setDraftPrivate(false)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                !draftPrivate ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-muted/60'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Public
            </button>
            <button
              type="button"
              onClick={() => setDraftPrivate(true)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                draftPrivate ? 'border-galli-violet bg-galli-violet/10 text-galli-violet font-medium' : 'border-border hover:bg-muted/60'
              }`}
            >
              <Lock className="w-3.5 h-3.5" /> Private
            </button>
          </div>

          {draftPrivate && (
            <div className="space-y-1.5">
              {hasPasscode && !removePasscode && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Passcode is set</span>
                  <button
                    type="button"
                    onClick={() => setRemovePasscode(true)}
                    className="text-galli-violet hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
              {!removePasscode && (
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder={hasPasscode ? 'Change passcode' : 'Set passcode (optional)'}
                  className="w-full px-2 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              )}
              {removePasscode && (
                <p className="text-xs text-muted-foreground">
                  Passcode will be removed — visible only to you &amp; collaborators.
                </p>
              )}
              {!hasPasscode && !passcode && (
                <p className="text-xs text-muted-foreground">
                  No passcode = visible only to you &amp; collaborators.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-0.5">
            <button
              type="button"
              onClick={apply}
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <UpgradePrompt isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} feature="Private Hub content" />
    </div>
  )
}
