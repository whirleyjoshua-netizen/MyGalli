'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface PublicSlideshowElementProps {
  element: CanvasElement
}

export function PublicSlideshowElement({ element }: PublicSlideshowElementProps) {
  const slides = element.slideshowSlides || []
  const height = element.slideshowHeight || 400
  const showOverlay = element.slideshowShowOverlay ?? true
  const [currentSlide, setCurrentSlide] = useState(0)

  if (slides.length === 0) return null

  const slide = slides[currentSlide]

  const goTo = (index: number) => {
    setCurrentSlide((index + slides.length) % slides.length)
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg group"
      style={{ height: `${height}px` }}
    >
      {/* Slides with fade */}
      {slides.map((s, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-500 ease-in-out"
          style={{ opacity: i === currentSlide ? 1 : 0, pointerEvents: i === currentSlide ? 'auto' : 'none' }}
        >
          {s.imageUrl ? (
            <img
              src={s.imageUrl}
              alt={s.title || `Slide ${i + 1}`}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-muted" />
          )}

          {/* Dark overlay */}
          {showOverlay && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          )}

          {/* Text content */}
          {(s.title || s.description || s.buttonText) && (
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              {s.title && <h3 className="text-2xl font-bold mb-1">{s.title}</h3>}
              {s.description && <p className="text-sm opacity-90 mb-3">{s.description}</p>}
              {s.buttonText && s.buttonUrl ? (
                <a
                  href={s.buttonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-5 py-2.5 bg-white/20 backdrop-blur-sm rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
                >
                  {s.buttonText}
                </a>
              ) : s.buttonText ? (
                <span className="inline-block px-5 py-2.5 bg-white/20 backdrop-blur-sm rounded-lg text-sm font-medium">
                  {s.buttonText}
                </span>
              ) : null}
            </div>
          )}
        </div>
      ))}

      {/* Navigation arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => goTo(currentSlide - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => goTo(currentSlide + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === currentSlide ? 'bg-white scale-110' : 'bg-white/50 hover:bg-white/80'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
