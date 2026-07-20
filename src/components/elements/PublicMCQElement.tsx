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

export function PublicMCQElement({ element, displayId }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`form_submitted_${element.id}`) === 'true'
    }
    return false
  })
  const [submitting, setSubmitting] = useState(false)

  const options = element.mcqOptions || []
  const allowMultiple = element.mcqAllowMultiple || false

  const handleSelect = (option: string) => {
    if (submitted) return
    if (allowMultiple) {
      setSelected(prev =>
        prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
      )
    } else {
      setSelected([option])
    }
  }

  const handleSubmit = async () => {
    if (selected.length === 0 || submitting || submitted) return
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
              type: 'mcq',
              question: element.mcqQuestion,
              answer: allowMultiple ? selected : selected[0],
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
      console.error('Failed to submit MCQ:', error)
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
      <div className="text-lg font-medium mb-4">
        {element.mcqQuestion}
        {element.mcqRequired && <span className="text-destructive ml-1">*</span>}
      </div>
      <div className="space-y-2">
        {options.map((option, index) => (
          <label
            key={index}
            onClick={() => handleSelect(option)}
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
              selected.includes(option)
                ? 'border-primary bg-primary/5'
                : 'border-transparent hover:bg-muted/50'
            }`}
          >
            {allowMultiple ? (
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                selected.includes(option) ? 'border-primary bg-primary' : 'border-muted-foreground/40'
              }`}>
                {selected.includes(option) && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
            ) : (
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                selected.includes(option) ? 'border-primary' : 'border-muted-foreground/40'
              }`}>
                {selected.includes(option) && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
            )}
            <span>{option}</span>
          </label>
        ))}
      </div>
      <button
        onClick={handleSubmit}
        disabled={selected.length === 0 || submitting}
        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
    </div>
  )
}
