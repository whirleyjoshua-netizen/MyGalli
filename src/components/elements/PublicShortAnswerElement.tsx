'use client'

import { useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'
import { Check } from 'lucide-react'
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

export function PublicShortAnswerElement({ element, displayId }: Props) {
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`form_submitted_${element.id}`) === 'true'
    }
    return false
  })
  const [submitting, setSubmitting] = useState(false)

  const maxLength = element.shortAnswerMaxLength || 500

  const handleSubmit = async () => {
    if (!answer.trim() || submitting || submitted) return
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
              type: 'shortanswer',
              question: element.shortAnswerQuestion,
              answer: answer.trim(),
            },
          },
        }),
      })

      if (res.ok) {
        setSubmitted(true)
        localStorage.setItem(`form_submitted_${element.id}`, 'true')
        void trackInteraction(displayId, element.id, 'form', 'submit')
      }
    } catch (error) {
      console.error('Failed to submit answer:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg border border-border">
        <div className="flex items-center gap-2 text-green-600">
          <Check className="w-5 h-5" />
          <span className="font-medium">Response submitted</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Thank you for your answer.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-muted/30 rounded-lg border border-border">
      <div className="text-lg font-medium mb-3">
        {element.shortAnswerQuestion}
        {element.shortAnswerRequired && <span className="text-destructive ml-1">*</span>}
      </div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={element.shortAnswerPlaceholder}
        maxLength={maxLength}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        rows={3}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">
          {answer.length}/{maxLength}
        </span>
        <button
          onClick={handleSubmit}
          disabled={!answer.trim() || submitting}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
