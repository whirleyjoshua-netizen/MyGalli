import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

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
      select: { id: true, userId: true, title: true },
    })

    if (!display) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }

    if (display.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get query params for pagination
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50') || 50))
    const skip = (page - 1) * limit

    // Get total count
    const totalCount = await db.formResponse.count({
      where: { displayId },
    })

    // Get form responses
    const responses = await db.formResponse.findMany({
      where: { displayId },
      orderBy: { submittedAt: 'desc' },
      skip,
      take: limit,
    })

    return NextResponse.json({
      display: {
        id: display.id,
        title: display.title,
      },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      responses: responses.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        responses: r.responses,
        submittedAt: r.submittedAt,
      })),
    })
  } catch (error) {
    console.error('Form responses fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 })
  }
}

// Delete a specific response
export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { displayId } = await params
    const url = new URL(request.url)
    const responseId = url.searchParams.get('responseId')

    if (!responseId) {
      return NextResponse.json({ error: 'responseId is required' }, { status: 400 })
    }

    // Verify authentication
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get display and verify ownership
    const display = await db.display.findUnique({
      where: { id: displayId },
      select: { id: true, userId: true },
    })

    if (!display || display.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete the response
    await db.formResponse.delete({
      where: { id: responseId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Form response delete error:', error)
    return NextResponse.json({ error: 'Failed to delete response' }, { status: 500 })
  }
}
