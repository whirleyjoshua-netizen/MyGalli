'use client'

import { useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'
import { Star, Check } from 'lucide-react'
import { trackInteraction } from '@/lib/analytics'

interface Props {
  element: CanvasElement
  displayId: string
}

function getSessionId() {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem('pages_form_session')
  if (!id) {
    id = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('pages_form_session', id)
  }
  return id
}

export function PublicRatingElement({ element, displayId }: Props) {
  const [rating, setRating] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`form_submitted_${element.id}`) === 'true'
    }
    return false
  })
  const [submitting, setSubmitting] = useState(false)

  const max = element.ratingMax || 5
  const style = element.ratingStyle || 'stars'

  const handleSubmit = async () => {
    if (rating === null || submitting || submitted) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/forms/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayId,
          sessionId: getSessionId(),
          responses: {
            [element.id]: {
              type: 'rating',
              question: element.ratingQuestion,
              answer: rating,
            },
          },
        }),
      })

      if (res.ok) {
        setSubmitted(true)
        localStorage.setItem(`form_submitted_${element.id}`, 'true')
        void trackInteraction(displayId, element.id, 'rating', 'submit')
      }
    } catch (error) {
      console.error('Failed to submit rating:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-center gap-2 text-green-600">
          <Check className="w-5 h-5" />
          <span className="font-medium">Rating submitted</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          You rated {rating} out of {max}. Thank you!
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-muted/30 rounded-lg border border-border">
      <div className="text-lg font-medium mb-4">
        {element.ratingQuestion}
        {element.ratingRequired && <span className="text-destructive ml-1">*</span>}
      </div>

      {style === 'stars' ? (
        <div className="flex items-center gap-1">
          {Array.from({ length: max }, (_, i) => {
            const value = i + 1
            const active = value <= (hovered ?? rating ?? 0)
            return (
              <button
                key={i}
                onClick={() => setRating(value)}
                onMouseEnter={() => setHovered(value)}
                onMouseLeave={() => setHovered(null)}
                className="p-1 hover:scale-110 transition-transform"
              >
                <Star className={`w-8 h-8 transition-colors ${
                  active
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-muted-foreground/30'
                }`} />
              </button>
            )
          })}
          {rating !== null && (
            <span className="ml-2 text-sm text-muted-foreground">{rating}/{max}</span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {Array.from({ length: max }, (_, i) => {
            const value = i + 1
            return (
              <button
                key={i}
                onClick={() => setRating(value)}
                className={`w-10 h-10 rounded-lg border-2 font-medium transition-all ${
                  rating === value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary hover:bg-primary/5'
                }`}
              >
                {value}
              </button>
            )
          })}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={rating === null || submitting}
        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
    </div>
  )
}
