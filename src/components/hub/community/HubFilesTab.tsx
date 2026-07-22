'use client'

import { useMemo, useState } from 'react'
import { FileText, Lock, Download, X } from 'lucide-react'
import { HubFolderTree } from '@/components/hub/HubFolderTree'
import { buildFolderTree } from '@/lib/hub-tree'
import { itemsInFolder, type FileFolder, type FileItem } from '@/lib/hub-files-view'

/**
 * The community hub's Files tab.
 *
 * `canManage` is OWNER-ONLY, not `canModerate`. Every file-mutation route
 * (items, items/[itemId], folders, folders/[folderId]) gates on
 * `hub.userId !== me.id` and 404s collaborators, so rendering manage controls
 * to a collaborator would ship buttons that fail. Widening those routes would
 * also grant collaborators on existing file-only data-rooms upload/delete
 * rights — deliberately out of scope. See the plan's "Deviation from spec D4".
 */
export function HubFilesTab({
  hubId, canManage, initialFolders, initialItems,
}: {
  hubId: string
  canManage: boolean
  initialFolders: FileFolder[]
  initialItems: FileItem[]
}) {
  const [folders, setFolders] = useState<FileFolder[]>(initialFolders)
  const [items, setItems] = useState<FileItem[]>(initialItems)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const tree = useMemo(() => buildFolderTree(folders), [folders])
  const visible = useMemo(() => itemsInFolder(items, folderId), [items, folderId])

  async function createFolder() {
    const name = window.prompt('Folder name')?.trim()
    if (!name) return
    setBusy(true)
    try {
      const res = await fetch(`/api/hubs/${hubId}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: folderId }),
      })
      if (!res.ok) return
      const { id } = await res.json()
      setFolders((cur) => [...cur, { id, parentId: folderId, name, order: cur.length, locked: false }])
    } finally {
      setBusy(false)
    }
  }

  async function deleteItem(it: FileItem) {
    if (!window.confirm(`Delete "${it.title}"?`)) return
    const res = await fetch(`/api/hubs/${hubId}/items/${it.id}`, { method: 'DELETE' })
    if (res.ok) setItems((cur) => cur.filter((x) => x.id !== it.id))
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="rounded-2xl border border-border bg-surface p-3">
        <HubFolderTree tree={tree} selectedId={folderId} onSelect={setFolderId} />
      </aside>

      <section className="rounded-2xl border border-border bg-surface p-4">
        {canManage && (
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={createFolder}
              disabled={busy}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              New folder
            </button>
          </div>
        )}

        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {canManage ? 'Nothing here yet — upload a file to get started.' : 'Nothing here yet.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((it) => (
              <li key={it.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                {it.locked
                  ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  : <FileText className="h-4 w-4 shrink-0 text-primary" />}
                <span className="min-w-0 flex-1 truncate text-sm">{it.title}</span>
                {/* A locked item keeps its name but never its url — the server
                    already nulled it, so there is nothing to link to. */}
                {!it.locked && it.url && (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={it.title}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" /> Open
                  </a>
                )}
                {canManage && (
                  <button
                    type="button"
                    aria-label={`Delete ${it.title}`}
                    onClick={() => deleteItem(it)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
