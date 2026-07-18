import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryWorkspaceView } from '@/lib/workspaces/query-view'

// GET /api/workspaces/[id]/views/[viewId]/records - Query records
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; viewId: string }> }
) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: workspaceId, viewId } = await params
  const searchParams = request.nextUrl.searchParams
  // Clamped the same way as the main GET /api/workspaces/[id]: this route was
  // dormant until the UI switched its record source to it, so its previously
  // unreachable input surface (e.g. ?pageSize=abc -> NaN -> take:NaN -> 500,
  // or ?page=0 -> negative skip -> 500) is now reachable.
  const parsedPage = parseInt(searchParams.get('page') || '1')
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1
  const parsedPageSize = parseInt(searchParams.get('pageSize') || '100')
  const pageSize = Number.isFinite(parsedPageSize) ? Math.min(200, Math.max(1, parsedPageSize)) : 100
  const search = (searchParams.get('search') || '').slice(0, 200)

  try {
    const result = await queryWorkspaceView({
      workspaceId,
      viewId,
      userId: user.id,
      page,
      pageSize,
      search,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'View not found' || error.message === 'Unauthorized or Workspace not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('Query view error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
