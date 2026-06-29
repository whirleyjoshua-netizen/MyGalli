import { NextResponse } from 'next/server'
import { getExploreRows } from '@/lib/explore'

export async function GET() {
  try {
    return NextResponse.json(await getExploreRows())
  } catch (e) {
    console.error('Explore rows error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
