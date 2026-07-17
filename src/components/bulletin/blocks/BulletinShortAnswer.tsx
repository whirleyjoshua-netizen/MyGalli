'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { ShortAnswerAggregate } from '@/lib/element-aggregate'
import type { BulletinBlockProps } from '../BulletinBlock'

export function BulletinShortAnswer({ postId, basePath, block, results, myResponse, onResults }: BulletinBlockProps) {
  const priorAnswer = myResponse?.[block.id]?.answer
  const [submitted, setSubmitted] = useState(false)
  const answered = (priorAnswer != null && priorAnswer !== '') || submitted
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localResults, setLocalResults] = useState<ShortAnswerAggregate | null>((results as ShortAnswerAggregate) || null)

  const submit = async () => {
    const answer = value.trim()
    if (!answer || submitting || answered) return
    setSubmitting(true)
    try {
      const res = await fetch(`${basePath}/${postId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: { [block.id]: { type: 'shortanswer', question: block.shortAnswerQuestion, answer } } }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.results) {
          setLocalResults(data.results)
          onResults(data.results)
        }
        setSubmitted(true)
      }
    } catch {
      /* degrade quietly */
    } finally {
      setSubmitting(false)
    }
  }

  if (answered) {
    return (
      <div className="rounded-xl border border-border bg-surface p-3">
        <p className="text-sm font-semibold text-foreground mb-1">{block.shortAnswerQuestion || 'Your answer'}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-primary" /> Answered{localResults ? ` · ${localResults.responseCount} total` : ''}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-sm font-semibold text-foreground mb-2">{block.shortAnswerQuestion || 'Your answer'}</p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={block.shortAnswerPlaceholder || 'Type your answer…'}
        rows={2}
        maxLength={block.shortAnswerMaxLength || 500}
        className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={submit}
          disabled={!value.trim() || submitting}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
