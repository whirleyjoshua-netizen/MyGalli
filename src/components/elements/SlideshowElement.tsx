'use client'

import { useState, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Plus, Trash2, Upload, Link, Loader2, GripVertical } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

type Slide = { imageUrl: string; title: string; description: string; buttonText?: string; buttonUrl?: string }

interface SlideshowElementProps {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function SlideshowElement({
  element,
  onChange,
  onDelete,
  isSelected,
  onSelect,
}: SlideshowElementProps) {
  const slides = element.slideshowSlides || []
  const height = element.slideshowHeight || 400
  const showOverlay = element.slideshowShowOverlay ?? true

  const [currentSlide, setCurrentSlide] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateSlides = (newSlides: Slide[]) => {
    onChange({ slideshowSlides: newSlides })
  }

  const updateSlide = (index: number, updates: Partial<Slide>) => {
    const newSlides = slides.map((s, i) => i === index ? { ...s, ...updates } : s)
    updateSlides(newSlides)
  }

  const addSlide = () => {
    updateSlides([...slides, { imageUrl: '', title: '', description: '' }])
    setCurrentSlide(slides.length)
  }

  const removeSlide = (index: number) => {
    if (slides.length <= 1) return
    const newSlides = slides.filter((_, i) => i !== index)
    updateSlides(newSlides)
    if (currentSlide >= newSlides.length) setCurrentSlide(Math.max(0, newSlides.length - 1))
  }

  const moveSlide = (from: number, to: number) => {
    if (to < 0 || to >= slides.length) return
    const newSlides = [...slides]
    const [moved] = newSlides.splice(from, 1)
    newSlides.splice(to, 0, moved)
    updateSlides(newSlides)
    setCurrentSlide(to)
  }

  const handleFileUpload = async (file: File, slideIndex: number) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) return
    if (file.size > 10 * 1024 * 1024) return

    setIsUploading(true)
    setUploadingIndex(slideIndex)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/upload', { method: 'POST', body: formData })
      if (response.ok) {
        const data = await response.json()
        updateSlide(slideIndex, { imageUrl: data.url })
      }
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
      setUploadingIndex(null)
    }
  }

  const slide = slides[currentSlide]

  return (
    <div
      className={`relative group rounded-lg overflow-hidden transition-all ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onSelect}
    >
      {/* Slide Preview */}
      <div
        className="relative w-full overflow-hidden rounded-lg bg-muted/30"
        style={{ height: `${height}px` }}
      >
        {slide?.imageUrl ? (
          <img
            src={slide.imageUrl}
            alt={slide.title || ''}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <p className="text-muted-foreground text-sm">No image — add one below</p>
          </div>
        )}

        {/* Overlay */}
        {showOverlay && slide?.imageUrl && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        )}

        {/* Text overlay */}
        {slide && (slide.title || slide.description || slide.buttonText) && (
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            {slide.title && <h3 className="text-2xl font-bold mb-1">{slide.title}</h3>}
            {slide.description && <p className="text-sm opacity-90 mb-3">{slide.description}</p>}
            {slide.buttonText && (
              <span className="inline-block px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-sm font-medium">
                {slide.buttonText}
              </span>
            )}
          </div>
        )}

        {/* Navigation arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentSlide((currentSlide - 1 + slides.length) % slides.length) }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentSlide((currentSlide + 1) % slides.length) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {slides.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setCurrentSlide(i) }}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentSlide ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        )}

        {/* Slide counter */}
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/40 text-white text-xs rounded-full">
          {currentSlide + 1} / {slides.length}
        </div>
      </div>

      {/* Edit Panel (when selected) */}
      {isSelected && (
        <div className="mt-3 space-y-3 p-3 bg-muted/30 rounded-lg border border-border" onClick={(e) => e.stopPropagation()}>
          {/* Settings row */}
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Height:</span>
              <input
                type="number"
                value={height}
                onChange={(e) => onChange({ slideshowHeight: parseInt(e.target.value) || 400 })}
                className="w-20 px-2 py-1 border border-border rounded bg-background text-sm"
                min={200}
                max={800}
              />
              <span className="text-muted-foreground text-xs">px</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOverlay}
                onChange={(e) => onChange({ slideshowShowOverlay: e.target.checked })}
                className="rounded"
              />
              <span className="text-muted-foreground">Dark overlay</span>
            </label>
          </div>

          {/* Slide list */}
          <div className="space-y-2">
            {slides.map((s, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border transition-colors ${
                  i === currentSlide ? 'border-primary bg-primary/5' : 'border-border bg-background'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setCurrentSlide(i)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Slide {i + 1}
                  </button>
                  <div className="flex items-center gap-1">
                    {i > 0 && (
                      <button onClick={() => moveSlide(i, i - 1)} className="p-0.5 hover:bg-muted rounded" title="Move up">
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                    )}
                    {i < slides.length - 1 && (
                      <button onClick={() => moveSlide(i, i + 1)} className="p-0.5 hover:bg-muted rounded" title="Move down">
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                    {slides.length > 1 && (
                      <button
                        onClick={() => removeSlide(i)}
                        className="p-0.5 hover:bg-destructive/10 text-destructive rounded"
                        title="Remove slide"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Image input */}
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={s.imageUrl}
                    onChange={(e) => updateSlide(i, { imageUrl: e.target.value })}
                    placeholder="Image URL..."
                    className="flex-1 px-2 py-1.5 border border-border rounded bg-background text-sm"
                  />
                  <button
                    onClick={() => {
                      setUploadingIndex(i)
                      fileInputRef.current?.click()
                    }}
                    className="px-2 py-1.5 bg-muted hover:bg-muted/80 rounded text-sm flex items-center gap-1"
                    disabled={isUploading}
                  >
                    {isUploading && uploadingIndex === i ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                  </button>
                </div>

                {/* Title + Description */}
                <input
                  type="text"
                  value={s.title}
                  onChange={(e) => updateSlide(i, { title: e.target.value })}
                  placeholder="Slide title..."
                  className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm mb-2"
                />
                <input
                  type="text"
                  value={s.description}
                  onChange={(e) => updateSlide(i, { description: e.target.value })}
                  placeholder="Slide description..."
                  className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm mb-2"
                />

                {/* Optional button */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={s.buttonText || ''}
                    onChange={(e) => updateSlide(i, { buttonText: e.target.value })}
                    placeholder="Button text (optional)"
                    className="flex-1 px-2 py-1.5 border border-border rounded bg-background text-sm"
                  />
                  <input
                    type="text"
                    value={s.buttonUrl || ''}
                    onChange={(e) => updateSlide(i, { buttonUrl: e.target.value })}
                    placeholder="Button URL"
                    className="flex-1 px-2 py-1.5 border border-border rounded bg-background text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add slide button */}
          <button
            onClick={addSlide}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Slide
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && uploadingIndex !== null) {
            handleFileUpload(file, uploadingIndex)
          }
          e.target.value = ''
        }}
        className="hidden"
      />

      {/* Delete button */}
      {isSelected && (
        <button
          className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors z-10"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          type="button"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
