import { WorkspaceGrid } from '@/components/workspaces/WorkspaceGrid'

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WorkspaceGrid workspaceId={id} />
}
