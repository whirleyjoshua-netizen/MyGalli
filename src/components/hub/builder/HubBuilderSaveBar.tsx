'use client'

import { Loader2, Check } from 'lucide-react'

export function HubBuilderSaveBar({ saving, dirty, lastSaved, conflict }: { saving: boolean; dirty: boolean; lastSaved: Date | null; conflict: boolean }) {
  return (
    <div className="flex items-center gap-2 border-t border-border bg-surface px-6 py-3 text-sm">
      {conflict ? (
        <span className="text-destructive">Someone else edited this hub — reload to continue.</span>
      ) : saving ? (
        <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span>
      ) : dirty ? (
        <span className="text-muted-foreground">Unsaved changes…</span>
      ) : lastSaved ? (
        <span className="flex items-center gap-1.5 text-muted-foreground"><Check className="h-3.5 w-3.5 text-primary" /> Saved</span>
      ) : (
        <span className="text-muted-foreground">All changes save automatically.</span>
      )}
    </div>
  )
}
