import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

// GET /api/displays/[id]/poll?elementId=xxx — get poll results
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const elementId = request.nextUrl.searchParams.get('elementId')
    if (!elementId) {
      return NextResponse.json({ error: 'elementId required' }, { status: 400 })
    }

    // Get all poll votes from FormResponse
    const responses = await db.formResponse.findMany({
      where: {
        displayId: id,
      },
    })

    // Tally votes for this element
    const votes: Record<string, number> = {}
    let totalVoters = 0

    for (const response of responses) {
      const data = response.responses as Record<string, any>
      const pollData = data[elementId]
      if (pollData && pollData.type === 'poll') {
        totalVoters++
        const selections = Array.isArray(pollData.answer) ? pollData.answer : [pollData.answer]
        for (const option of selections) {
          votes[option] = (votes[option] || 0) + 1
        }
      }
    }

    return NextResponse.json({ votes, totalVoters })
  } catch (error) {
    console.error('Error fetching poll results:', error)
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 })
  }
}

// POST /api/displays/[id]/poll — submit a vote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'poll' })
  if (limited) return limited

  const { id } = await params
  try {
    const body = await request.json()
    const { elementId, selections, sessionId } = body

    if (!elementId || !selections || selections.length === 0) {
      return NextResponse.json({ error: 'elementId and selections required' }, { status: 400 })
    }

    // Check for existing vote from this session
    if (sessionId) {
      const existing = await db.formResponse.findFirst({
        where: {
          displayId: id,
          sessionId,
        },
      })

      if (existing) {
        const data = existing.responses as Record<string, any>
        if (data[elementId]) {
          return NextResponse.json({ error: 'Already voted' }, { status: 409 })
        }

        // Add poll vote to existing form response
        await db.formResponse.update({
          where: { id: existing.id },
          data: {
            responses: {
              ...data,
              [elementId]: { type: 'poll', answer: selections },
            },
          },
        })

        return NextResponse.json({ success: true })
      }
    }

    // Create new form response with the poll vote
    await db.formResponse.create({
      data: {
        displayId: id,
        sessionId: sessionId || null,
        responses: {
          [elementId]: { type: 'poll', answer: selections },
        },
      },
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Error submitting vote:', error)
    return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 })
  }
}
