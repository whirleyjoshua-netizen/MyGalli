'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Save, Eye } from 'lucide-react'
import { ProfileFieldsPanel } from '@/components/profile/ProfileFieldsPanel'
import { ProfileCanvasEditor } from '@/components/profile/ProfileCanvasEditor'
import type { User } from '@/lib/types'
import type { Section } from '@/lib/types/canvas'
import type { BackgroundConfig } from '@/lib/types/background'
import type { SpacingConfig } from '@/lib/types/spacing'

export function ProfileEditor({
  username,
  user,
  displayId,
  initialSections,
  initialBackground,
  initialSpacing,
  initialVersion,
}: {
  username: string
  user: User
  displayId: string
  initialSections: Section[]
  initialBackground: BackgroundConfig | null
  initialSpacing: SpacingConfig | null
  initialVersion: number
}) {
  const [fieldsSaving, setFieldsSaving] = useState(false)
  const [canvasSaving, setCanvasSaving] = useState(false)
  const [everSaved, setEverSaved] = useState(false)
  const saving = fieldsSaving || canvasSaving

  const onFields = (s: boolean) => { setFieldsSaving(s); if (!s) setEverSaved(true) }
  const onCanvas = (s: boolean) => { setCanvasSaving(s); if (!s) setEverSaved(true) }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/${username}`} className="p-2 hover:bg-muted rounded-lg transition" aria-label="Back to profile">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-lg font-bold">Edit profile</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {saving ? (
              <><Save className="w-4 h-4 animate-pulse" /><span>Saving…</span></>
            ) : everSaved ? (
              <><Check className="w-4 h-4 text-green-500" /><span>Saved</span></>
            ) : null}
          </div>
          <Link href={`/${username}`} className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:brightness-105 transition">
            <Eye className="w-4 h-4" /> View Profile
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <ProfileFieldsPanel user={user} onSavingChange={onFields} />
        <ProfileCanvasEditor
          displayId={displayId}
          initialSections={initialSections}
          initialBackground={initialBackground}
          initialSpacing={initialSpacing}
          initialVersion={initialVersion}
          onSavingChange={onCanvas}
        />
      </div>
    </div>
  )
}
