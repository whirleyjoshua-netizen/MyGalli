'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import type { RatingAggregate } from '@/lib/element-aggregate'
import type { BulletinBlockProps } from '../BulletinBlock'

export function BulletinRating({ postId, block, results, myResponse, onResults }: BulletinBlockProps) {
  const max = block.ratingMax || 5
  const priorAnswer = myResponse?.[block.id]?.answer
  const answered = priorAnswer != null
  const [rating, setRating] = useState<number | null>(answered ? Number(priorAnswer) : null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [localResults, setLocalResults] = useState<RatingAggregate | null>((results as RatingAggregate) || null)

  const submit = async () => {
    if (rating === null || submitting || answered) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bulletin/${postId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: { [block.id]: { type: 'rating', question: block.ratingQuestion, answer: rating } } }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.results) {
          setLocalResults(data.results)
          onResults(data.results)
        }
      }
    } catch {
      /* degrade quietly */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-sm font-semibold text-foreground mb-2">{block.ratingQuestion || 'How would you rate this?'}</p>
      <div className="flex items-center gap-1">
        {Array.from({ length: max }, (_, i) => {
          const value = i + 1
          const active = value <= (hovered ?? rating ?? 0)
          return (
            <button
              key={i}
              onClick={() => !answered && setRating(value)}
              onMouseEnter={() => !answered && setHovered(value)}
              onMouseLeave={() => setHovered(null)}
              disabled={answered}
              className="p-0.5 transition-transform hover:scale-110 disabled:hover:scale-100"
              aria-label={`Rate ${value}`}
            >
              <Star className={`h-6 w-6 ${active ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`} />
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {localResults ? `Avg ${localResults.average} · ${localResults.responseCount} ${localResults.responseCount === 1 ? 'rating' : 'ratings'}` : answered ? 'Thanks!' : ''}
        </span>
        {!answered && (
          <button
            onClick={submit}
            disabled={rating === null || submitting}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        )}
      </div>
    </div>
  )
}
