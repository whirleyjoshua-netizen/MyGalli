'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Check } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { trackInteraction } from '@/lib/analytics'

interface PublicPollElementProps {
  element: CanvasElement
  displayId: string
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

function getSessionId() {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem('poll_session')
  if (!id) {
    id = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('poll_session', id)
  }
  return id
}

export function PublicPollElement({ element, displayId }: PublicPollElementProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [votes, setVotes] = useState<Record<string, number>>({})
  const [totalVoters, setTotalVoters] = useState(0)
  const [hasVoted, setHasVoted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const question = element.pollQuestion || 'What do you think?'
  const options = element.pollOptions || ['Option 1', 'Option 2', 'Option 3']
  const allowMultiple = element.pollAllowMultiple ?? false
  const showResultsBefore = element.pollShowResultsBeforeVote ?? false

  // Check if already voted (via localStorage)
  useEffect(() => {
    const voted = localStorage.getItem(`poll_voted_${element.id}`)
    if (voted) {
      setHasVoted(true)
      setShowResults(true)
    }
  }, [element.id])

  // Fetch results
  useEffect(() => {
    if (!displayId) return
    fetch(`/api/displays/${displayId}/poll?elementId=${element.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.votes) setVotes(data.votes)
        if (data.totalVoters !== undefined) setTotalVoters(data.totalVoters)
      })
      .catch(() => {})
  }, [displayId, element.id, hasVoted])

  const toggleOption = (option: string) => {
    if (hasVoted) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(option)) {
        next.delete(option)
      } else {
        if (!allowMultiple) next.clear()
        next.add(option)
      }
      return next
    })
  }

  const handleVote = async () => {
    if (selected.size === 0 || submitting) return
    setSubmitting(true)

    try {
      const res = await fetch(`/api/displays/${displayId}/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elementId: element.id,
          selections: Array.from(selected),
          sessionId: getSessionId(),
        }),
      })

      if (res.ok || res.status === 409) {
        setHasVoted(true)
        setShowResults(true)
        localStorage.setItem(`poll_voted_${element.id}`, 'true')
        void trackInteraction(displayId, element.id, 'poll', 'vote')
        // Re-fetch results
        const data = await fetch(`/api/displays/${displayId}/poll?elementId=${element.id}`).then(r => r.json())
        if (data.votes) setVotes(data.votes)
        if (data.totalVoters !== undefined) setTotalVoters(data.totalVoters)
      }
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false)
    }
  }

  const shouldShowResults = showResults || showResultsBefore
  const totalVotes = Object.values(votes).reduce((s, v) => s + v, 0) || 1

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-purple-500" />
        <h3 className="text-lg font-bold text-slate-900">{question}</h3>
      </div>

      {/* Options */}
      <div className="p-5 space-y-2.5">
        {options.map((option, index) => {
          const color = COLORS[index % COLORS.length]
          const voteCount = votes[option] || 0
          const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0
          const isSelected = selected.has(option)

          return (
            <button
              key={index}
              onClick={() => toggleOption(option)}
              disabled={hasVoted}
              className={`w-full relative rounded-xl border-2 text-left transition-all overflow-hidden ${
                hasVoted
                  ? 'cursor-default border-slate-100'
                  : isSelected
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Result bar background */}
              {shouldShowResults && (
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-700 ease-out rounded-l-lg"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
                    opacity: 0.12,
                  }}
                />
              )}

              <div className="relative px-4 py-3 flex items-center gap-3">
                {/* Radio/check indicator */}
                {!hasVoted && (
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected ? 'border-purple-500 bg-purple-500' : 'border-slate-300'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                )}

                <span className="text-sm font-medium text-slate-800 flex-1">{option}</span>

                {/* Vote count + percentage */}
                {shouldShowResults && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
                    <span className="text-xs text-slate-400">({voteCount})</span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {totalVoters} {totalVoters === 1 ? 'vote' : 'votes'}
        </span>

        {!hasVoted ? (
          <button
            onClick={handleVote}
            disabled={selected.size === 0 || submitting}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? 'Voting...' : 'Vote'}
          </button>
        ) : (
          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Voted
          </span>
        )}
      </div>
    </div>
  )
}
