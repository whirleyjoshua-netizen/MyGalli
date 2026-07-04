'use client'
import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

const COLS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }

export function PublicGalleryElement({ element }: { element: CanvasElement }) {
  const images = (element.galleryImages || []).filter((i) => i.url)
  const [open, setOpen] = useState<number | null>(null)
  const cols = COLS[element.galleryColumns || 3] || COLS[3]

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowRight') setOpen((o) => (o === null ? o : (o + 1) % images.length))
      if (e.key === 'ArrowLeft') setOpen((o) => (o === null ? o : (o - 1 + images.length) % images.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, images.length])

  if (images.length === 0) return null
  const cur = open !== null ? images[open] : null
  return (
    <div className="space-y-3">
      {element.galleryTitle && <h3 className="text-lg font-bold">{element.galleryTitle}</h3>}
      <div className={`grid ${cols} gap-2`}>
        {images.map((img, i) => (
          <button key={i} aria-label={`View image ${i + 1}`} onClick={() => setOpen(i)}
            className="relative aspect-square overflow-hidden rounded-lg group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt || img.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          </button>
        ))}
      </div>
      {cur && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <button aria-label="Close" onClick={() => setOpen(null)} className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"><X className="w-6 h-6" /></button>
          {images.length > 1 && (
            <>
              <button aria-label="Previous" onClick={(e) => { e.stopPropagation(); setOpen((o) => (o! - 1 + images.length) % images.length) }} className="absolute left-4 p-2 text-white/80 hover:text-white"><ChevronLeft className="w-8 h-8" /></button>
              <button aria-label="Next" onClick={(e) => { e.stopPropagation(); setOpen((o) => (o! + 1) % images.length) }} className="absolute right-4 p-2 text-white/80 hover:text-white"><ChevronRight className="w-8 h-8" /></button>
            </>
          )}
          <figure className="max-w-4xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.url} alt={cur.alt || cur.caption || ''} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            {cur.caption && <figcaption className="text-center text-white/80 text-sm mt-2">{cur.caption}</figcaption>}
          </figure>
        </div>
      )}
    </div>
  )
}
