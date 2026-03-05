import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import type { Section } from '@/lib/types/canvas'
import type { TabsConfig } from '@/lib/types/tabs'

const INTERACTIVE_TYPES = ['mcq', 'rating', 'shortanswer', 'poll', 'comment', 'wedding-rsvp', 'business-review'] as const

interface InteractiveElement {
  id: string
  type: string
  config: Record<string, any>
  tabLabel?: string
}

function extractInteractiveElements(
  sections: Section[],
  tabLabel?: string
): InteractiveElement[] {
  const results: InteractiveElement[] = []

  for (const section of sections) {
    for (const column of section.columns || []) {
      for (const el of column.elements || []) {
        if ((INTERACTIVE_TYPES as readonly string[]).includes(el.type)) {
          results.push({
            id: el.id,
            type: el.type,
            config: el,
            tabLabel,
          })
        }
      }
    }
  }
  return results
}

interface Props {
  params: Promise<{ displayId: string }>
}

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { displayId } = await params

    // Verify authentication
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get display and verify ownership
    const display = await db.display.findUnique({
      where: { id: displayId },
      select: { id: true, userId: true, title: true, sections: true, tabs: true },
    })

    if (!display) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }
    if (display.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse sections and tabs to discover interactive elements
    const mainSections: Section[] = typeof display.sections === 'string'
      ? JSON.parse(display.sections)
      : (display.sections as unknown as Section[]) || []

    const tabsConfig: TabsConfig | null = display.tabs
      ? (typeof display.tabs === 'string' ? JSON.parse(display.tabs) : display.tabs as unknown as TabsConfig)
      : null

    const allElements: InteractiveElement[] = [
      ...extractInteractiveElements(mainSections),
      ...(tabsConfig?.tabs || []).flatMap(tab =>
        extractInteractiveElements(tab.sections || [], tab.label)
      ),
    ]

    if (allElements.length === 0) {
      return NextResponse.json({ display: { id: display.id, title: display.title }, elements: [] })
    }

    // Fetch all form responses for aggregation
    const formResponses = await db.formResponse.findMany({
      where: { displayId },
      orderBy: { submittedAt: 'desc' },
    })

    // Fetch all comments (including unapproved) for this display
    const allComments = await db.comment.findMany({
      where: { displayId },
      orderBy: { createdAt: 'desc' },
    })

    // Aggregate per element
    const elements = allElements.map(el => {
      switch (el.type) {
        case 'mcq': return aggregateMCQ(el, formResponses)
        case 'rating': return aggregateRating(el, formResponses)
        case 'shortanswer': return aggregateShortAnswer(el, formResponses)
        case 'poll': return aggregatePoll(el, formResponses)
        case 'comment': return aggregateComments(el, allComments)
        case 'wedding-rsvp': return aggregateWeddingRsvp(el, formResponses)
        case 'business-review': return aggregateBusinessReview(el, formResponses)
        default: return null
      }
    }).filter(Boolean)

    return NextResponse.json({
      display: { id: display.id, title: display.title },
      elements,
    })
  } catch (error) {
    console.error('Element analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch element analytics' }, { status: 500 })
  }
}

function aggregateMCQ(el: InteractiveElement, responses: any[]) {
  const options: string[] = el.config.mcqOptions || []
  const distribution: Record<string, number> = {}
  for (const opt of options) distribution[opt] = 0

  let responseCount = 0

  for (const response of responses) {
    const data = response.responses as Record<string, any>
    const entry = data[el.id]
    if (entry && (entry.type === 'mcq' || entry.type === 'form')) {
      responseCount++
      const answers = Array.isArray(entry.answer) ? entry.answer : [entry.answer]
      for (const ans of answers) {
        if (ans in distribution) {
          distribution[ans]++
        } else {
          distribution[ans] = (distribution[ans] || 0) + 1
        }
      }
    }
  }

  const total = responseCount
  return {
    elementId: el.id,
    type: 'mcq',
    question: el.config.mcqQuestion || 'Untitled Question',
    options,
    allowMultiple: el.config.mcqAllowMultiple || false,
    responseCount,
    distribution: Object.entries(distribution).map(([option, count]) => ({
      option,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    })),
    tabLabel: el.tabLabel,
  }
}

function aggregateRating(el: InteractiveElement, responses: any[]) {
  const max = el.config.ratingMax || 5
  const distribution: Record<number, number> = {}
  for (let i = 1; i <= max; i++) distribution[i] = 0

  let responseCount = 0
  let sum = 0

  for (const response of responses) {
    const data = response.responses as Record<string, any>
    const entry = data[el.id]
    if (entry && entry.type === 'rating') {
      const value = Number(entry.answer)
      if (value >= 1 && value <= max) {
        responseCount++
        sum += value
        distribution[value]++
      }
    }
  }

  return {
    elementId: el.id,
    type: 'rating',
    question: el.config.ratingQuestion || 'Untitled Rating',
    ratingMax: max,
    ratingStyle: el.config.ratingStyle || 'stars',
    responseCount,
    average: responseCount > 0 ? Math.round((sum / responseCount) * 10) / 10 : 0,
    distribution: Object.entries(distribution)
      .map(([value, count]) => ({ value: Number(value), count }))
      .sort((a, b) => b.value - a.value),
    tabLabel: el.tabLabel,
  }
}

function aggregateShortAnswer(el: InteractiveElement, responses: any[]) {
  const answers: { answer: string; submittedAt: string; sessionId?: string }[] = []

  for (const response of responses) {
    const data = response.responses as Record<string, any>
    const entry = data[el.id]
    if (entry && entry.type === 'shortanswer' && entry.answer) {
      answers.push({
        answer: String(entry.answer),
        submittedAt: response.submittedAt?.toISOString?.() || response.submittedAt,
        sessionId: response.sessionId || undefined,
      })
    }
  }

  return {
    elementId: el.id,
    type: 'shortanswer',
    question: el.config.shortAnswerQuestion || 'Untitled Question',
    responseCount: answers.length,
    recentAnswers: answers.slice(0, 50),
    tabLabel: el.tabLabel,
  }
}

function aggregatePoll(el: InteractiveElement, responses: any[]) {
  const options: string[] = el.config.pollOptions || []
  const distribution: Record<string, number> = {}
  for (const opt of options) distribution[opt] = 0

  let totalVoters = 0

  for (const response of responses) {
    const data = response.responses as Record<string, any>
    const entry = data[el.id]
    if (entry && entry.type === 'poll') {
      totalVoters++
      const selections = Array.isArray(entry.answer) ? entry.answer : [entry.answer]
      for (const option of selections) {
        if (option in distribution) {
          distribution[option]++
        } else {
          distribution[option] = (distribution[option] || 0) + 1
        }
      }
    }
  }

  return {
    elementId: el.id,
    type: 'poll',
    question: el.config.pollQuestion || 'Untitled Poll',
    options,
    allowMultiple: el.config.pollAllowMultiple || false,
    totalVoters,
    distribution: Object.entries(distribution).map(([option, count]) => ({
      option,
      count,
      percentage: totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0,
    })),
    tabLabel: el.tabLabel,
  }
}

function aggregateComments(el: InteractiveElement, comments: any[]) {
  const approved = comments.filter(c => c.approved)
  const pending = comments.filter(c => !c.approved)

  return {
    elementId: el.id,
    type: 'comment',
    title: el.config.commentTitle || 'Comments',
    moderated: el.config.commentModerated || false,
    totalComments: comments.length,
    approvedCount: approved.length,
    pendingCount: pending.length,
    comments: comments.map(c => ({
      id: c.id,
      authorName: c.authorName,
      authorEmail: c.authorEmail,
      content: c.content,
      approved: c.approved,
      createdAt: c.createdAt?.toISOString?.() || c.createdAt,
    })),
    tabLabel: el.tabLabel,
  }
}

function aggregateWeddingRsvp(el: InteractiveElement, responses: any[]) {
  let responseCount = 0
  let attending = 0
  let declined = 0
  let plusOnes = 0
  const mealDistribution: Record<string, number> = {}
  const dietaryNotes: string[] = []
  const songRequests: string[] = []
  const guests: { name: string; attending: boolean; meal?: string; plusOneName?: string; submittedAt: string }[] = []

  for (const response of responses) {
    const data = response.responses as Record<string, any>
    const entry = data[el.id]
    if (entry && entry.type === 'wedding-rsvp') {
      responseCount++
      const answer = entry.answer || {}

      if (answer.attending) {
        attending++
      } else {
        declined++
      }

      if (answer.plusOneName) {
        plusOnes++
      }

      if (answer.meal) {
        mealDistribution[answer.meal] = (mealDistribution[answer.meal] || 0) + 1
      }

      if (answer.dietary) {
        dietaryNotes.push(answer.dietary)
      }

      if (answer.songRequest) {
        songRequests.push(answer.songRequest)
      }

      guests.push({
        name: answer.name || 'Anonymous',
        attending: !!answer.attending,
        meal: answer.meal,
        plusOneName: answer.plusOneName,
        submittedAt: response.submittedAt?.toISOString?.() || response.submittedAt,
      })
    }
  }

  return {
    elementId: el.id,
    type: 'wedding-rsvp',
    title: el.config.weddingRsvpTitle || 'RSVP',
    responseCount,
    attending,
    declined,
    plusOnes,
    totalHeadcount: attending + plusOnes,
    mealDistribution: Object.entries(mealDistribution).map(([meal, count]) => ({
      meal,
      count,
      percentage: attending > 0 ? Math.round((count / attending) * 100) : 0,
    })),
    dietaryNotes: dietaryNotes.slice(0, 50),
    songRequests: songRequests.slice(0, 50),
    guests,
    tabLabel: el.tabLabel,
  }
}

function aggregateBusinessReview(el: InteractiveElement, responses: any[]) {
  const distribution: Record<number, number> = {}
  for (let i = 1; i <= 5; i++) distribution[i] = 0

  let responseCount = 0
  let sum = 0
  const reviews: { name: string; rating: number; text: string; submittedAt: string }[] = []

  for (const response of responses) {
    const data = response.responses as Record<string, any>
    const entry = data[el.id]
    if (entry && entry.type === 'business-review') {
      const answer = entry.answer || {}
      const rating = Number(answer.rating)
      if (rating >= 1 && rating <= 5) {
        responseCount++
        sum += rating
        distribution[rating]++
        reviews.push({
          name: answer.name || 'Anonymous',
          rating,
          text: answer.text || '',
          submittedAt: response.submittedAt?.toISOString?.() || response.submittedAt,
        })
      }
    }
  }

  return {
    elementId: el.id,
    type: 'business-review',
    title: el.config.bizReviewTitle || 'Customer Reviews',
    responseCount,
    averageRating: responseCount > 0 ? Math.round((sum / responseCount) * 10) / 10 : 0,
    ratingDistribution: Object.entries(distribution)
      .map(([value, count]) => ({ value: Number(value), count }))
      .sort((a, b) => b.value - a.value),
    recentReviews: reviews.slice(0, 50),
    tabLabel: el.tabLabel,
  }
}
