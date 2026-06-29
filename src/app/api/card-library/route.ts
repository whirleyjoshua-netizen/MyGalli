import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { CARD_PROVIDERS } from '@/lib/cards/registry'
import { isPro } from '@/lib/plan'

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const items = await db.cardLibraryItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('GET /api/card-library error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isPro(user)) {
      return NextResponse.json({ error: 'Pro required' }, { status: 403 })
    }

    const body = await request.json()
    const { provider, name, data, style } = body

    if (!provider || !name) {
      return NextResponse.json({ error: 'provider and name are required' }, { status: 400 })
    }

    if (!CARD_PROVIDERS[provider]) {
      return NextResponse.json({ error: 'Unknown card provider' }, { status: 400 })
    }

    if (CARD_PROVIDERS[provider].status !== 'live') {
      return NextResponse.json({ error: 'This app is not available to add yet' }, { status: 400 })
    }

    const item = await db.cardLibraryItem.create({
      data: {
        userId: user.id,
        provider,
        name,
        data: data || CARD_PROVIDERS[provider].defaultData,
        style: style || 'default',
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('POST /api/card-library error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
