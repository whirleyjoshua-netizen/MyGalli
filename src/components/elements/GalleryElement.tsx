'use client'

import { useRef, useState } from 'react'
import { Trash2, X, ImageIcon, Images, Upload, Loader2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function GalleryElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const images = element.galleryImages ?? []
  const columns = element.galleryColumns ?? 3
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const updateCaption = (index: number, value: string) => {
    const updated = [...images]
    updated[index] = { ...updated[index], caption: value }
    onChange({ galleryImages: updated })
  }

  const removeImage = (index: number) => {
    onChange({ galleryImages: images.filter((_, i) => i !== index) })
  }

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
      onChange({ galleryImages: [...images, { url: data.url, caption: '' }] })
    } catch (error) {
      console.error('Upload error:', error)
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
    e.target.value = ''
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-[#FF6B6B] border-[#FF6B6B]/30' : 'border-border hover:border-[#FF6B6B]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Images className="w-4 h-4 text-[#FF6B6B]" />
            <input
              type="text"
              value={element.galleryTitle ?? ''}
              onChange={(e) => onChange({ galleryTitle: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="Gallery title"
              className="text-sm font-semibold bg-transparent border-none outline-none"
            />
          </div>
          <select
            value={columns}
            onChange={(e) => onChange({ galleryColumns: Number(e.target.value) as 2 | 3 | 4 })}
            onClick={(e) => e.stopPropagation()}
            className="text-xs bg-muted border border-border rounded px-2 py-1 outline-none"
          >
            <option value={2}>2 cols</option>
            <option value={3}>3 cols</option>
            <option value={4}>4 cols</option>
          </select>
        </div>

        <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : columns === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {images.map((img, index) => (
            <div key={index} className="relative group/item border border-border rounded-lg overflow-hidden bg-muted/30">
              {img.url ? (
                <img src={img.url} alt={img.caption || ''} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                </div>
              )}
              <div className="p-1.5">
                <input
                  type="text"
                  value={img.caption ?? ''}
                  onChange={(e) => updateCaption(index, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Caption"
                  className="w-full text-[10px] bg-transparent border border-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[#FF6B6B]"
                />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeImage(index) }}
                className="absolute top-1 right-1 p-1 bg-background/80 rounded-md text-muted-foreground hover:text-destructive opacity-0 group-hover/item:opacity-100 transition"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          <button
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
            disabled={isUploading}
            className="w-full aspect-square flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-[#FF6B6B]/50 hover:text-[#FF6B6B] transition"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span className="text-[10px]">Upload</span>
              </>
            )}
          </button>
        </div>

        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
          onChange={handleFileSelect}
          onClick={(e) => e.stopPropagation()}
          className="hidden"
        />
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
