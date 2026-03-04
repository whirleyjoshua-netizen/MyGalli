import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: { dashboardPrefs: true },
    })

    return NextResponse.json(fullUser?.dashboardPrefs || {})
  } catch (error) {
    console.error('GET /api/dashboard-prefs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const prefs = await request.json()

    if (typeof prefs !== 'object' || prefs === null || Array.isArray(prefs)) {
      return NextResponse.json({ error: 'Invalid preferences format' }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: { dashboardPrefs: prefs },
      select: { dashboardPrefs: true },
    })

    return NextResponse.json(updated.dashboardPrefs)
  } catch (error) {
    console.error('PATCH /api/dashboard-prefs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
