'use client'

import { useRef, useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'

type Props = {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const field = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none'
const label = 'block text-xs font-semibold text-muted-foreground mb-1'

async function uploadFile(file: File): Promise<{ url: string; name: string }> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Upload failed')
  }
  const data = await res.json()
  return { url: data.url as string, name: file.name }
}

export function LeadGenElement({ element, onChange, onSelect, isSelected }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const { url, name } = await uploadFile(file)
      onChange({ leadGenFileUrl: url, leadGenFileName: name })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl border bg-surface p-4 space-y-3 ${isSelected ? 'border-primary' : 'border-border'}`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Lead Gen</p>

      <div>
        <label className={label} htmlFor="lg-headline">Headline</label>
        <input
          id="lg-headline"
          className={field}
          value={element.leadGenHeadline ?? ''}
          onChange={(e) => onChange({ leadGenHeadline: e.target.value })}
          placeholder="Get my free press kit"
        />
      </div>

      <div>
        <label className={label} htmlFor="lg-message">Message emailed to the visitor</label>
        <textarea
          id="lg-message"
          className={field}
          rows={3}
          value={element.leadGenMessage ?? ''}
          onChange={(e) => onChange({ leadGenMessage: e.target.value })}
          placeholder="Add a link or a discount code here"
        />
      </div>

      <div>
        <span className={label}>File (optional — PDF or image)</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-lg bg-muted px-3 py-2 text-sm font-medium transition hover:brightness-95 disabled:opacity-60"
          >
            {uploading
              ? 'Uploading…'
              : element.leadGenFileUrl
                ? `Replace file (${element.leadGenFileName})`
                : 'Attach a file'}
          </button>
          {element.leadGenFileUrl && (
            <button
              type="button"
              onClick={() => onChange({ leadGenFileUrl: undefined, leadGenFileName: undefined })}
              className="text-xs text-muted-foreground hover:underline"
            >
              Remove file
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          aria-label="Upload a file to deliver"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label} htmlFor="lg-button">Button label</label>
          <input
            id="lg-button"
            className={field}
            value={element.leadGenButtonLabel ?? ''}
            onChange={(e) => onChange({ leadGenButtonLabel: e.target.value })}
          />
        </div>
        <div>
          <label className={label} htmlFor="lg-success">Success message</label>
          <input
            id="lg-success"
            className={field}
            value={element.leadGenSuccessText ?? ''}
            onChange={(e) => onChange({ leadGenSuccessText: e.target.value })}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={element.leadGenCollectName ?? false}
          onChange={(e) => onChange({ leadGenCollectName: e.target.checked })}
        />
        Also collect the visitor&apos;s name
      </label>
    </div>
  )
}
