import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'

// Returns the current authenticated user (including up-to-date `plan`) so the
// client can refresh its persisted store without requiring a re-login.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ user })
  } catch (error) {
    console.error('GET /api/auth/me error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
