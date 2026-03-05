import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

// GET /api/share-links/check?code=xxx - Check if a code is available
export async function GET(request: NextRequest) {
  try {
    const rateLimited = await rateLimit(request, { limit: 30, windowMs: 60_000, prefix: 'share-check' })
    if (rateLimited) return rateLimited

    const code = request.nextUrl.searchParams.get('code')?.toLowerCase().trim()

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }

    const existing = await db.shareLink.findUnique({
      where: { code },
    })

    if (existing) {
      // Suggest alternative with capped iterations
      let suggestion = `${code}-1`
      let counter = 1
      const MAX_ATTEMPTS = 10
      while (counter <= MAX_ATTEMPTS) {
        const check = await db.shareLink.findUnique({
          where: { code: suggestion },
        })
        if (!check) break
        counter++
        suggestion = `${code}-${counter}`
      }

      return NextResponse.json({ available: false, suggestion })
    }

    return NextResponse.json({ available: true })
  } catch (error) {
    console.error('GET /api/share-links/check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
