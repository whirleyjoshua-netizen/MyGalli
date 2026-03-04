'use client'

import { useState, useEffect } from 'react'
import { Inbox } from 'lucide-react'
import { MCQCard, RatingCard, ShortAnswerCard, PollCard, CommentCard, WeddingRsvpCard } from './element-cards'

interface ElementsTabProps {
  displayId: string | null
}

interface ElementAnalyticsResponse {
  display: { id: string; title: string }
  elements: any[]
}

export function ElementsTab({ displayId }: ElementsTabProps) {
  const [data, setData] = useState<ElementAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!displayId) return

    setLoading(true)
    fetch(`/api/analytics/${displayId}/elements`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [displayId])

  if (!displayId) {
    return (
      <div className="text-center py-20">
        <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-medium mb-2">No page selected</h2>
        <p className="text-muted-foreground">
          Select a page to view element responses.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading element data...</p>
      </div>
    )
  }

  if (!data || data.elements.length === 0) {
    return (
      <div className="text-center py-20">
        <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-medium mb-2">No interactive elements</h2>
        <p className="text-muted-foreground">
          Add MCQ, Rating, Poll, Comment, Short Answer, or Wedding RSVP elements to your page to see responses here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          {data.elements.length} interactive element{data.elements.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {data.elements.map((element: any) => {
        switch (element.type) {
          case 'mcq':
            return <MCQCard key={element.elementId} data={element} />
          case 'rating':
            return <RatingCard key={element.elementId} data={element} />
          case 'shortanswer':
            return <ShortAnswerCard key={element.elementId} data={element} />
          case 'poll':
            return <PollCard key={element.elementId} data={element} />
          case 'comment':
            return <CommentCard key={element.elementId} data={element} displayId={displayId} />
          case 'wedding-rsvp':
            return <WeddingRsvpCard key={element.elementId} data={element} />
          default:
            return null
        }
      })}
    </div>
  )
}
