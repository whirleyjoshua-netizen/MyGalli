'use client'

import { useRef, useState } from 'react'
import { Trash2, Contrast, Upload, Loader2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

function UploadSlot({
  label,
  url,
  onUploaded,
}: {
  label: string
  url?: string
  onUploaded: (url: string) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileUpload = async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Use JPEG, PNG, GIF, WebP, or SVG')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 10MB')
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await response.json()
      onUploaded(data.url)
    } catch (error) {
      console.error('Upload error:', error)
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="w-14 h-14 object-cover rounded-lg border border-border" />
        ) : (
          <div className="w-14 h-14 rounded-lg border-2 border-dashed border-border bg-muted/30" />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            fileInputRef.current?.click()
          }}
          disabled={isUploading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-foreground rounded-lg hover:bg-muted/80 text-sm"
        >
          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {label}
        </button>
      </div>
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}

export function BeforeAfterElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-[#39D98A] border-[#39D98A]/30' : 'border-border hover:border-[#39D98A]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Contrast className="w-4 h-4 text-[#39D98A]" />
          <span className="text-sm font-semibold">Before / After</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <UploadSlot
              label="Before image"
              url={element.beforeAfterBefore}
              onUploaded={(url) => onChange({ beforeAfterBefore: url })}
            />
            <input
              type="text"
              value={element.beforeAfterBeforeLabel ?? 'Before'}
              onChange={(e) => onChange({ beforeAfterBeforeLabel: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="Before label"
              className="w-full text-sm px-2 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#39D98A]"
            />
          </div>
          <div className="space-y-2">
            <UploadSlot
              label="After image"
              url={element.beforeAfterAfter}
              onUploaded={(url) => onChange({ beforeAfterAfter: url })}
            />
            <input
              type="text"
              value={element.beforeAfterAfterLabel ?? 'After'}
              onChange={(e) => onChange({ beforeAfterAfterLabel: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="After label"
              className="w-full text-sm px-2 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#39D98A]"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Height (px)
          <input
            type="number"
            min={100}
            value={element.beforeAfterHeight ?? 400}
            onChange={(e) => onChange({ beforeAfterHeight: Number(e.target.value) || 400 })}
            onClick={(e) => e.stopPropagation()}
            className="w-24 px-2 py-1 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#39D98A]"
          />
        </label>
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
