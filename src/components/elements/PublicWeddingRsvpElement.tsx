'use client'

import { useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'
import { Heart, Check } from 'lucide-react'

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

export function PublicWeddingRsvpElement({ element, displayId }: Props) {
  const [name, setName] = useState('')
  const [attending, setAttending] = useState<'yes' | 'no' | null>(null)
  const [meal, setMeal] = useState('')
  const [plusOneName, setPlusOneName] = useState('')
  const [dietary, setDietary] = useState('')
  const [songRequest, setSongRequest] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`form_submitted_${element.id}`) === 'true'
    }
    return false
  })
  const [error, setError] = useState('')

  const title = element.weddingRsvpTitle || 'RSVP'
  const deadline = element.weddingRsvpDeadline || ''
  const fields = element.weddingRsvpFields || {
    attending: true,
    plusOne: false,
    mealOptions: [],
    dietaryField: false,
    songRequest: false,
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter your name.')
      return
    }
    if (fields.attending && attending === null) {
      setError('Please indicate whether you will be attending.')
      return
    }
    if (submitting || submitted) return

    setError('')
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
              type: 'wedding-rsvp',
              question: title,
              answer: {
                name: name.trim(),
                attending: attending,
                meal: meal || undefined,
                plusOneName: plusOneName.trim() || undefined,
                dietary: dietary.trim() || undefined,
                songRequest: songRequest.trim() || undefined,
              },
            },
          },
        }),
      })

      if (res.ok) {
        setSubmitted(true)
        localStorage.setItem(`form_submitted_${element.id}`, 'true')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch (err) {
      console.error('Failed to submit RSVP:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-[#E8B4B8]/30 bg-[#E8B4B8]/5 p-8 text-center">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E8B4B8' }}>
            <Check className="w-6 h-6 text-white" />
          </div>
        </div>
        <h3 className="text-lg font-semibold mb-1" style={{ color: '#C49A9E' }}>
          Thank You!
        </h3>
        <p className="text-sm text-muted-foreground">
          Your RSVP has been received. We look forward to celebrating with you!
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#E8B4B8]/30 bg-[#E8B4B8]/5 p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <Heart className="w-6 h-6 mx-auto mb-2" style={{ color: '#E8B4B8', fill: '#E8B4B8' }} />
        <h3 className="text-xl font-semibold" style={{ color: '#C49A9E' }}>{title}</h3>
        {deadline && (
          <p className="text-xs text-muted-foreground mt-1">
            Please respond by {new Date(deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {/* Guest Name (always shown) */}
        <div>
          <label className="text-sm font-medium block mb-1.5" style={{ color: '#C49A9E' }}>
            Guest Name <span className="text-[#E8B4B8]">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full px-4 py-2.5 rounded-xl border border-[#E8B4B8]/30 bg-white/70 text-sm outline-none focus:border-[#E8B4B8] focus:ring-2 focus:ring-[#E8B4B8]/20 transition placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Attending (Yes/No) */}
        {fields.attending && (
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: '#C49A9E' }}>
              Will you be attending?
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setAttending('yes')}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition ${
                  attending === 'yes'
                    ? 'border-[#E8B4B8] bg-[#E8B4B8]/10 text-[#C49A9E]'
                    : 'border-[#E8B4B8]/30 bg-white/50 text-muted-foreground hover:border-[#E8B4B8]/50'
                }`}
              >
                Joyfully Accept
              </button>
              <button
                type="button"
                onClick={() => setAttending('no')}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition ${
                  attending === 'no'
                    ? 'border-[#E8B4B8] bg-[#E8B4B8]/10 text-[#C49A9E]'
                    : 'border-[#E8B4B8]/30 bg-white/50 text-muted-foreground hover:border-[#E8B4B8]/50'
                }`}
              >
                Regretfully Decline
              </button>
            </div>
          </div>
        )}

        {/* Conditional fields: only show when attending = 'yes' (or attending toggle is off) */}
        {(attending === 'yes' || !fields.attending) && (
          <>
            {/* Meal Selection */}
            {(fields.mealOptions || []).length > 0 && (
              <div>
                <label className="text-sm font-medium block mb-2" style={{ color: '#C49A9E' }}>
                  Meal Selection
                </label>
                <div className="space-y-2">
                  {(fields.mealOptions || []).map((option, index) => (
                    <label
                      key={index}
                      onClick={() => setMeal(option)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition ${
                        meal === option
                          ? 'border-[#E8B4B8] bg-[#E8B4B8]/10'
                          : 'border-[#E8B4B8]/20 bg-white/50 hover:border-[#E8B4B8]/40'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition ${
                        meal === option ? 'border-[#E8B4B8]' : 'border-[#E8B4B8]/40'
                      }`}>
                        {meal === option && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#E8B4B8' }} />}
                      </div>
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Plus One */}
            {fields.plusOne && (
              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: '#C49A9E' }}>
                  Plus One Name
                </label>
                <input
                  type="text"
                  value={plusOneName}
                  onChange={(e) => setPlusOneName(e.target.value)}
                  placeholder="Guest name (if applicable)"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E8B4B8]/30 bg-white/70 text-sm outline-none focus:border-[#E8B4B8] focus:ring-2 focus:ring-[#E8B4B8]/20 transition placeholder:text-muted-foreground/50"
                />
              </div>
            )}

            {/* Dietary Restrictions */}
            {fields.dietaryField && (
              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: '#C49A9E' }}>
                  Dietary Restrictions
                </label>
                <input
                  type="text"
                  value={dietary}
                  onChange={(e) => setDietary(e.target.value)}
                  placeholder="Allergies, preferences, etc."
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E8B4B8]/30 bg-white/70 text-sm outline-none focus:border-[#E8B4B8] focus:ring-2 focus:ring-[#E8B4B8]/20 transition placeholder:text-muted-foreground/50"
                />
              </div>
            )}

            {/* Song Request */}
            {fields.songRequest && (
              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: '#C49A9E' }}>
                  Song Request
                </label>
                <input
                  type="text"
                  value={songRequest}
                  onChange={(e) => setSongRequest(e.target.value)}
                  placeholder="What song gets you on the dance floor?"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E8B4B8]/30 bg-white/70 text-sm outline-none focus:border-[#E8B4B8] focus:ring-2 focus:ring-[#E8B4B8]/20 transition placeholder:text-muted-foreground/50"
                />
              </div>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        {/* Submit */}
        <div className="pt-2 flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-8 py-2.5 rounded-full text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#E8B4B8' }}
          >
            {submitting ? 'Sending...' : 'Send RSVP'}
          </button>
        </div>
      </div>
    </div>
  )
}
