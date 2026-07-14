'use client'

import { useState, useEffect, useCallback } from 'react'
import { WorkspaceTable } from '@/components/workspaces/WorkspaceTable'
import { ViewConfigPanel } from '@/components/workspaces/ViewConfigPanel'

export default function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then(p => setWorkspaceId(p.id))
  }, [params])

  const fetchData = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    // POC: Fetching default view (first one found)
    const res = await fetch(`/api/workspaces/${workspaceId}/views/default-id/records`)
    if (res.ok) {
      setData(await res.json())
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <div className="p-6">Loading...</div>
  if (!data) return <div className="p-6">Error loading workspace data.</div>

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 lg:p-8">
        <h1 className="text-2xl font-bold mb-6">{data.view.name}</h1>
        <WorkspaceTable fields={data.fields} records={data.records} />
      </div>
      <div className="w-80 border-l border-border bg-surface h-screen">
        <ViewConfigPanel 
          workspaceId={workspaceId!} 
          view={data.view} 
          fields={data.fields} 
          onUpdate={fetchData} 
        />
      </div>
    </div>
  )
}
