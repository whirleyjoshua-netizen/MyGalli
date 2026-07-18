import { Suspense } from 'react'
import { WorkspaceViews } from '@/components/workspaces/WorkspaceViews'

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <WorkspaceViews workspaceId={id} />
    </Suspense>
  )
}
