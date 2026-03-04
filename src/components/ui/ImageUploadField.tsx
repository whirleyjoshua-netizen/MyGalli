'use client'

import { useState, useRef } from 'react'
import { Upload, Link, Loader2, X, Image as ImageIcon } from 'lucide-react'

interface ImageUploadFieldProps {
  label: string
  value: string | undefined
  onChange: (url: string) => void
  placeholder?: string
  previewClass?: string  // Tailwind classes for the preview image container
  previewAspect?: 'square' | 'wide' | 'banner'
}

export function ImageUploadField({
  label,
  value,
  onChange,
  placeholder = 'https://example.com/image.jpg',
  previewAspect = 'wide',
}: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState(value || '')

  const aspectClass =
    previewAspect === 'square' ? 'aspect-square' :
    previewAspect === 'banner' ? 'aspect-[3/1]' :
    'aspect-video'

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
      onChange(data.url)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) handleFileUpload(file)
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>

      {value ? (
        /* Preview with change/remove controls */
        <div className="relative group">
          <div className={`${aspectClass} rounded-lg overflow-hidden border border-border bg-muted`}>
            <img
              src={value}
              alt={label}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><rect fill="%23f1f5f9" width="400" height="200"/><text fill="%2394a3b8" font-family="sans-serif" font-size="14" x="50%" y="50%" text-anchor="middle" dy=".3em">Image failed to load</text></svg>'
              }}
            />
          </div>
          {/* Overlay controls */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            {isUploading ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white text-black rounded-md text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </div>
            ) : (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white text-black rounded-md text-sm hover:bg-gray-100"
                >
                  Replace
                </button>
                <button
                  onClick={() => setShowUrlInput(true)}
                  className="px-3 py-1.5 bg-white text-black rounded-md text-sm hover:bg-gray-100"
                >
                  URL
                </button>
                <button
                  onClick={() => onChange('')}
                  className="p-1.5 bg-white text-destructive rounded-md hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Empty: drag-drop zone */
        <div
          className={`${aspectClass} max-h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-4 transition-colors cursor-pointer ${
            isDragging ? 'border-primary bg-primary/10' : 'border-border bg-muted/30 hover:border-primary/50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-6 h-6 text-primary animate-spin mb-1" />
              <p className="text-xs text-muted-foreground">Uploading...</p>
            </>
          ) : (
            <>
              <ImageIcon className="w-6 h-6 text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Drop image or click to upload</p>
              <button
                onClick={(e) => { e.stopPropagation(); setShowUrlInput(true) }}
                className="text-xs text-primary hover:underline mt-1"
              >
                or paste a URL
              </button>
            </>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* URL Input Popover */}
      {showUrlInput && (
        <div className="mt-2 p-3 border border-border rounded-lg bg-background">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onChange(urlInput); setShowUrlInput(false) }
              if (e.key === 'Escape') setShowUrlInput(false)
            }}
            placeholder={placeholder}
            className="w-full px-2 py-1.5 border border-border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => { onChange(urlInput); setShowUrlInput(false) }}
              className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs hover:opacity-90"
            >
              Save
            </button>
            <button
              onClick={() => { setShowUrlInput(false); setUrlInput(value || '') }}
              className="px-3 py-1 bg-muted text-foreground rounded text-xs hover:bg-muted/80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {uploadError && (
        <p className="text-xs text-destructive mt-1">{uploadError}</p>
      )}
    </div>
  )
}
