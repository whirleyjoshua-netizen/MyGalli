import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

interface Props {
  params: Promise<{ id: string }>
}

// GET /api/displays/[id]/signatures?elementId=xxx
export async function GET(request: NextRequest, { params }: Props) {
  const { id } = await params
  const elementId = request.nextUrl.searchParams.get('elementId')

  const where: Record<string, string> = { displayId: id }
  if (elementId) where.elementId = elementId

  const signatures = await db.jerseySignature.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      name: true,
      pathData: true,
      color: true,
      createdAt: true,
    },
  })

  return NextResponse.json(signatures)
}

// POST /api/displays/[id]/signatures
export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params

  try {
    const body = await request.json()
    const { elementId, name, pathData, color } = body

    // Validate required fields
    if (!elementId || !name || !pathData) {
      return NextResponse.json(
        { error: 'elementId, name, and pathData are required' },
        { status: 400 }
      )
    }

    // Validate lengths
    if (name.length > 30) {
      return NextResponse.json({ error: 'Name too long' }, { status: 400 })
    }
    if (pathData.length > 10000) {
      return NextResponse.json({ error: 'Signature too complex' }, { status: 400 })
    }

    // Verify display exists and is published
    const display = await db.display.findUnique({
      where: { id },
      select: { id: true, published: true },
    })

    if (!display || !display.published) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }

    // Hash IP for dedup
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)

    // Rate limit: max 3 signatures per IP per element
    const existingCount = await db.jerseySignature.count({
      where: { displayId: id, elementId, ipHash },
    })
    if (existingCount >= 3) {
      return NextResponse.json(
        { error: 'Maximum signatures reached for this jersey' },
        { status: 429 }
      )
    }

    const signature = await db.jerseySignature.create({
      data: {
        displayId: id,
        elementId,
        name: name.slice(0, 30),
        pathData,
        color: color || '#000000',
        ipHash,
      },
      select: {
        id: true,
        name: true,
        pathData: true,
        color: true,
        createdAt: true,
      },
    })

    return NextResponse.json(signature, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create signature' }, { status: 500 })
  }
}
