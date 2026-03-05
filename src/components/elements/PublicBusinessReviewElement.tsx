'use client'

import { useState } from 'react'
import { Star, MessageSquare, Send } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  displayId: string
}

export function PublicBusinessReviewElement({ element, displayId }: Props) {
  const curated = element.bizReviewCurated ?? []
  const allowSubmissions = element.bizReviewAllowSubmissions ?? true

  const [name, setName] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Check localStorage dedup
  const dedupKey = `biz-review-${displayId}-${element.id}`
  const alreadySubmitted = typeof window !== 'undefined' && localStorage.getItem(dedupKey) === 'true'

  const handleSubmit = async () => {
    if (!rating || !text.trim() || submitting) return
    setSubmitting(true)

    try {
      await fetch('/api/forms/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayId,
          responses: {
            [element.id]: {
              type: 'business-review',
              answer: { name: name.trim() || 'Anonymous', rating, text: text.trim() },
            },
          },
        }),
      })
      localStorage.setItem(dedupKey, 'true')
      setSubmitted(true)
    } catch (err) {
      console.error('Failed to submit review:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const renderStars = (count: number, size = 'w-4 h-4') => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`${size} ${i <= count ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      {element.bizReviewTitle && (
        <div className="flex items-center gap-2 text-lg font-bold text-foreground">
          <MessageSquare className="w-5 h-5 text-amber-500" />
          {element.bizReviewTitle}
        </div>
      )}

      {/* Curated reviews */}
      {curated.length > 0 && (
        <div className="space-y-3">
          {curated.map((review, index) => (
            <div key={index} className="border border-border rounded-xl p-4 space-y-2 bg-background">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold">
                    {(review.author || 'A')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{review.author}</div>
                    <div className="flex items-center gap-2">
                      {renderStars(review.rating, 'w-3 h-3')}
                      {review.date && <span className="text-[10px] text-muted-foreground">{review.date}</span>}
                    </div>
                  </div>
                </div>
                {review.source && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {review.source}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground leading-relaxed">{review.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Submission form */}
      {allowSubmissions && !alreadySubmitted && !submitted && (
        <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
          <h4 className="text-sm font-semibold">Leave a Review</h4>

          {/* Star rating input */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <button
                key={i}
                onClick={() => setRating(i)}
                onMouseEnter={() => setHoverRating(i)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-0.5"
              >
                <Star className={`w-6 h-6 transition ${
                  i <= (hoverRating || rating)
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-gray-200'
                }`} />
              </button>
            ))}
            {rating > 0 && <span className="text-xs text-muted-foreground ml-1">{rating}/5</span>}
          </div>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500/50"
          />

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your review..."
            rows={3}
            className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
          />

          <button
            onClick={handleSubmit}
            disabled={!rating || !text.trim() || submitting}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-full hover:bg-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      )}

      {(submitted || alreadySubmitted) && (
        <div className="border border-green-200 bg-green-50 rounded-xl p-4 text-center">
          <p className="text-sm font-medium text-green-700">Thank you for your review!</p>
          <p className="text-xs text-green-600 mt-1">Your review will appear after moderation.</p>
        </div>
      )}
    </div>
  )
}
