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
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '25')

  try {
    const result = await queryWorkspaceView({
      workspaceId,
      viewId,
      userId: user.id,
      page,
      pageSize,
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
