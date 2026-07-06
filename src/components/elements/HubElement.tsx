'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Boxes, Upload, Loader2, ArrowRight } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Upload failed')
  }
  const data = await response.json()
  return data.url
}

export function HubElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const router = useRouter()
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleCoverFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file')
      return
    }
    setIsUploading(true)
    setUploadError(null)
    try {
      const url = await uploadFile(file)
      onChange({ hubCoverImage: url })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-primary border-primary/30' : 'border-border hover:border-primary/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Boxes className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Hub</span>
        </div>

        <div className="flex items-center gap-3">
          {element.hubCoverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={element.hubCoverImage} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
          ) : (
            <span className="w-14 h-14 rounded-xl bg-gradient-to-br from-galli/30 to-galli-violet/30 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5 text-galli-dark" />
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); coverInputRef.current?.click() }}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted text-foreground rounded-lg hover:bg-muted/80 text-xs"
          >
            {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload cover
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverFile(f) }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <input
          type="text"
          value={element.hubTitleOverride ?? ''}
          onChange={(e) => onChange({ hubTitleOverride: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Title (optional)"
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

        <button
          onClick={(e) => { e.stopPropagation(); if (element.hubId) router.push('/hubs/' + element.hubId) }}
          disabled={!element.hubId}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline"
        >
          Open Hub <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
