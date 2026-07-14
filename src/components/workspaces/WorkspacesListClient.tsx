'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Database, Plus } from 'lucide-react'
import { CreateWorkspaceModal } from './CreateWorkspaceModal'

type WorkspaceSummary = { id: string; name: string; description: string | null; icon: string | null }

export function WorkspacesListClient() {
  const [items, setItems] = useState<WorkspaceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    fetch('/api/workspaces')
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="px-6 py-7 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          <p className="text-muted-foreground">Your data, organized.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-galli px-4 py-2 font-medium text-white">
          <Plus size={18} /> New workspace
        </button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Database className="mx-auto mb-3 text-muted-foreground" />
          <p className="mb-4 text-muted-foreground">No workspaces yet.</p>
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-galli px-4 py-2 font-medium text-white">
            Create your first
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ws) => (
            <Link key={ws.id} href={`/workspaces/${ws.id}`} className="rounded-xl border border-border bg-surface p-5 transition hover:shadow-md">
              <div className="mb-2 flex items-center gap-2">
                <Database size={18} className="text-galli" />
                <h3 className="font-semibold">{ws.name}</h3>
              </div>
              {ws.description && <p className="text-sm text-muted-foreground">{ws.description}</p>}
            </Link>
          ))}
        </div>
      )}

      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
