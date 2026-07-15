'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { PollAggregate } from '@/lib/element-aggregate'
import type { BulletinBlockProps } from '../BulletinBlock'

export function BulletinPoll({ postId, basePath, block, results, myResponse, onResults }: BulletinBlockProps) {
  const options = block.pollOptions || []
  const allowMultiple = block.pollAllowMultiple ?? false
  const priorAnswer = myResponse?.[block.id]?.answer
  const [submitted, setSubmitted] = useState(false)
  const answered = !!priorAnswer || submitted

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [localResults, setLocalResults] = useState<PollAggregate | null>((results as PollAggregate) || null)

  const showResults = !!localResults
  const total = localResults?.totalVoters || 0
  const pctByOption = new Map((localResults?.distribution || []).map((d) => [d.option, d]))

  const toggle = (opt: string) => {
    if (answered) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(opt)) next.delete(opt)
      else {
        if (!allowMultiple) next.clear()
        next.add(opt)
      }
      return next
    })
  }

  const vote = async () => {
    if (selected.size === 0 || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`${basePath}/${postId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses: { [block.id]: { type: 'poll', question: block.pollQuestion, answer: Array.from(selected) } },
        }),
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

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-sm font-semibold text-foreground mb-2">{block.pollQuestion || 'What do you think?'}</p>
      <div className="space-y-1.5">
        {options.map((opt) => {
          const d = pctByOption.get(opt)
          const isSel = selected.has(opt)
          const mineOpt = (submitted && selected.has(opt)) || (Array.isArray(priorAnswer) && (priorAnswer as string[]).includes(opt))
          return (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              disabled={answered || submitting}
              className={`relative w-full overflow-hidden rounded-lg border text-left transition-colors ${
                isSel ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              } ${answered ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {showResults && (
                <div className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500" style={{ width: `${d?.percentage ?? 0}%` }} />
              )}
              <div className="relative flex items-center gap-2 px-3 py-2">
                <span className="flex-1 text-sm text-foreground">{opt}</span>
                {mineOpt && <Check className="h-3.5 w-3.5 text-primary" />}
                {showResults && <span className="text-xs font-semibold text-muted-foreground">{d?.percentage ?? 0}%</span>}
              </div>
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{total} {total === 1 ? 'vote' : 'votes'}</span>
        {!answered && (
          <button
            onClick={vote}
            disabled={selected.size === 0 || submitting}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Voting…' : 'Vote'}
          </button>
        )}
      </div>
    </div>
  )
}
