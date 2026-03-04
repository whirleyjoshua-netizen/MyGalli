'use client'

import { useState, useRef } from 'react'
import { X, Image, Upload, Link, Loader2 } from 'lucide-react'

interface ImageElementProps {
  url: string
  alt: string
  caption: string
  onChange: (updates: { url?: string; alt?: string; caption?: string }) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function ImageElement({
  url,
  alt,
  caption,
  onChange,
  onDelete,
  isSelected,
  onSelect,
}: ImageElementProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState(url)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleUrlSubmit = () => {
    onChange({ url: urlInput })
    setShowUrlInput(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUrlSubmit()
    } else if (e.key === 'Escape') {
      setShowUrlInput(false)
      setUrlInput(url)
    }
  }

  const handleFileUpload = async (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Use JPEG, PNG, GIF, WebP, or SVG')
      return
    }

    // Validate file size (10MB)
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
      onChange({ url: data.url })
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
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      handleFileUpload(file)
    }
  }

  return (
    <div
      className={`relative group rounded-lg overflow-hidden transition-all ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onSelect}
    >
      {url ? (
        // Image display
        <div>
          <img
            src={url}
            alt={alt}
            className="w-full h-auto object-cover rounded-lg"
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><rect fill="%23f1f5f9" width="400" height="200"/><text fill="%2394a3b8" font-family="sans-serif" font-size="14" x="50%" y="50%" text-anchor="middle" dy=".3em">Image failed to load</text></svg>'
            }}
          />
          {caption && (
            <p className="text-sm text-muted-foreground mt-2 text-center italic">
              {caption}
            </p>
          )}

          {/* Edit overlay on hover when selected */}
          {isSelected && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {isUploading ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white text-black rounded-md text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </div>
              ) : (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                    className="px-3 py-1.5 bg-white text-black rounded-md text-sm hover:bg-gray-100"
                  >
                    Upload New
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowUrlInput(true)
                    }}
                    className="px-3 py-1.5 bg-white text-black rounded-md text-sm hover:bg-gray-100"
                  >
                    Change URL
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        // Empty state / upload prompt
        <div
          className={`min-h-[200px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-8 transition-colors ${
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border bg-muted/30'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-12 h-12 text-primary mb-3 animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </>
          ) : (
            <>
              <Image className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-1">
                Drag and drop an image here
              </p>
              <p className="text-xs text-muted-foreground mb-4">or</p>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowUrlInput(true)
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 text-sm"
                >
                  <Link className="w-4 h-4" />
                  URL
                </button>
              </div>
              {uploadError && (
                <p className="text-sm text-destructive mt-3">{uploadError}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Hidden file input - always rendered for both empty and existing image states */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* URL Input Modal */}
      {showUrlInput && (
        <div
          className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 rounded-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-background p-4 rounded-lg w-full max-w-md mx-4">
            <label className="block text-sm font-medium mb-2">Image URL</label>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleUrlSubmit}
                className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowUrlInput(false)
                  setUrlInput(url)
                }}
                className="px-3 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Button */}
      {isSelected && (
        <button
          className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors z-10"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          type="button"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
