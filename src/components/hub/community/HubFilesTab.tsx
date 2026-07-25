'use client'

import { useMemo, useRef, useState } from 'react'
import { FileText, Lock, Download, X, Upload, Loader2, Eye } from 'lucide-react'
import { HubFolderTree } from '@/components/hub/HubFolderTree'
import { HubFileViewer } from '@/components/hub/HubFileViewer'
import { buildFolderTree } from '@/lib/hub-tree'
import { itemsInFolder, type FileFolder, type FileItem } from '@/lib/hub-files-view'
import { newNoteBody, bookmarkUrl, type BookmarkLite } from '@/lib/hub-bookmark-requests'
import type { Rect } from '@/lib/hub-highlight'

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
  hubId, canManage, initialFolders, initialItems, notes = [], initialBookmarks = [],
}: {
  hubId: string
  canManage: boolean
  initialFolders: FileFolder[]
  initialItems: FileItem[]
  /** Visibility-filtered by the server. */
  notes?: { id: string; title: string; color: string }[]
  /** Visibility-filtered by the server — private-note marks never arrive here. */
  initialBookmarks?: BookmarkLite[]
}) {
  const [folders, setFolders] = useState<FileFolder[]>(initialFolders)
  const [items, setItems] = useState<FileItem[]>(initialItems)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Viewing is for everyone who can see the file — not gated on canManage.
  const [viewing, setViewing] = useState<FileItem | null>(null)
  const [noteList, setNoteList] = useState(notes)
  const [bookmarks, setBookmarks] = useState<BookmarkLite[]>(initialBookmarks)
  const fileInput = useRef<HTMLInputElement>(null)

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

  async function uploadFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      // 1. Store the bytes. The server validates type and size, so a rejection
      //    here must stop the flow — creating an item now would point it at
      //    nothing and leave a broken row the owner has to clean up.
      const fd = new FormData()
      fd.append('file', file)
      const up = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!up.ok) {
        setError((await up.json().catch(() => ({}))).error || 'Upload failed')
        return
      }
      const { url } = await up.json()

      // 2. Record it against the folder currently in view.
      const res = await fetch(`/api/hubs/${hubId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'file', title: file.name, url, folderId }),
      })
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || 'Could not add the file')
        return
      }
      const { id } = await res.json()
      setItems((cur) => [
        ...cur,
        { id, folderId, type: 'file', title: file.name, url, order: cur.length, locked: false },
      ])
    } finally {
      setUploading(false)
      // Let the same file be picked again after a failure.
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  // Returning null makes SelectionPopover abort cleanly rather than saving a
  // bookmark against a note that was never created.
  async function createNote(): Promise<string | null> {
    if (!viewing) return null
    const res = await fetch(`/api/hubs/${hubId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNoteBody(viewing.title)),
    })
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Could not create the note')
      return null
    }
    const n = await res.json()
    setNoteList((cur) => [...cur, { id: n.id, title: n.title, color: n.color }])
    return n.id
  }

  async function createBookmark(input: {
    noteId: string; itemId: string; page: number; rects: Rect[]; text: string; title: string
  }) {
    const res = await fetch(bookmarkUrl(hubId, input.noteId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Could not save the highlight')
      return
    }
    const b = await res.json()
    setBookmarks((cur) => [
      ...cur,
      { id: b.id, noteId: b.noteId, itemId: b.itemId, page: b.page, rects: b.rects, title: b.title },
    ])
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
          <div className="mb-3 flex items-center justify-end gap-2">
            {/* accept mirrors upload-validate's allow-list so the picker doesn't
                offer types the server will reject. */}
            <input
              ref={fileInput}
              id="hub-files-upload"
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav,audio/webm,video/mp4,video/webm,video/quicktime"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadFile(f)
              }}
            />
            <label
              htmlFor="hub-files-upload"
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? 'Uploading…' : 'Upload file'}
            </label>
            <button
              type="button"
              onClick={createFolder}
              disabled={busy || uploading}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              New folder
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
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
                  <>
                    <button
                      type="button"
                      aria-label={`View ${it.title}`}
                      onClick={() => setViewing(it)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Download ${it.title}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                  </>
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

      {/* Same viewer the data-room uses, so PDFs and images open in-app rather
          than dumping the visitor into a new tab. Bookmarking is deliberately
          not wired up here — it hangs off HubNote and needs its own design pass. */}
      <HubFileViewer
        file={viewing ? { id: viewing.id, type: viewing.type, title: viewing.title, url: viewing.url } : null}
        onClose={() => setViewing(null)}
        editable={canManage}
        notes={noteList}
        bookmarks={bookmarks}
        onCreateNote={createNote}
        onCreateBookmark={createBookmark}
      />
    </div>
  )
}
