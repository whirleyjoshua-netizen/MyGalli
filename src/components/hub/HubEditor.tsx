'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon, Loader2, Trash2, FolderPlus, ChevronRight, Users, UsersRound, StickyNote } from 'lucide-react'
import { buildFolderTree, folderPath, type FolderNode } from '@/lib/hub-tree'
import { HubFolderTree } from './HubFolderTree'
import { HubItemList, type HubItem } from './HubItemList'
import { HubNotesPanel, type HubNote } from './HubNotesPanel'
import { HubCollaboratorsModal } from './HubCollaboratorsModal'
import { HubPrivacyControl, type PrivacyApply } from './HubPrivacyControl'
import { HubCommunityConsole } from './HubCommunityConsole'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'
import { useAuthStore } from '@/lib/store'
import { isPro as checkPro } from '@/lib/plan'

interface Hub {
  id: string
  title: string
  description: string | null
  coverImage: string | null
  community: boolean
}

interface HubEditorProps {
  hubId: string
}

export function HubEditor({ hubId }: HubEditorProps) {
  const router = useRouter()
  const [hub, setHub] = useState<Hub | null>(null)
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [items, setItems] = useState<HubItem[]>([])
  const [notes, setNotes] = useState<HubNote[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [showCollaborators, setShowCollaborators] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showCommunity, setShowCommunity] = useState(false)

  const user = useAuthStore((s) => s.user)
  const isPro = checkPro(user)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/hubs/${hubId}`)
      .then(async (r) => {
        if (!r.ok) {
          if (!cancelled) router.replace('/dashboard')
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (cancelled || !data) return
        setHub(data.hub)
        setTitle(data.hub.title)
        setDescription(data.hub.description ?? '')
        setFolders(data.folders)
        setItems(data.items)
        setNotes(data.notes ?? [])
      })
      .catch(() => {
        if (!cancelled) router.replace('/dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [hubId, router])

  const tree = useMemo(() => buildFolderTree(folders), [folders])
  const breadcrumb = useMemo(
    () => (selectedFolderId ? folderPath(folders, selectedFolderId) : []),
    [folders, selectedFolderId]
  )
  const visibleItems = useMemo(
    () => items.filter((it) => (it.folderId ?? null) === selectedFolderId),
    [items, selectedFolderId]
  )
  const selectedFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId) ?? null,
    [folders, selectedFolderId]
  )

  const patchHub = useCallback(
    async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/hubs/${hubId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        setHub(updated)
      }
    },
    [hubId]
  )

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        await patchHub({ coverImage: data.url })
      }
    } finally {
      setUploadingCover(false)
    }
  }

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    setCreatingFolder(true)
    try {
      const res = await fetch(`/api/hubs/${hubId}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId: selectedFolderId }),
      })
      if (res.ok) {
        const folder = await res.json()
        setFolders((prev) => [...prev, folder])
        setNewFolderName('')
      }
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleRenameFolder = async (id: string) => {
    const folder = folders.find((f) => f.id === id)
    if (!folder) return
    const name = prompt('Rename folder', folder.name)?.trim()
    if (!name || name === folder.name) return
    const res = await fetch(`/api/hubs/${hubId}/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const updated = await res.json()
      setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)))
    }
  }

  const handleDeleteFolder = async (id: string) => {
    const folder = folders.find((f) => f.id === id)
    if (!folder) return
    if (!confirm(`Delete "${folder.name}" and everything inside it?`)) return
    const res = await fetch(`/api/hubs/${hubId}/folders/${id}`, { method: 'DELETE' })
    if (res.ok) {
      // Refetch since delete cascades to descendant folders/items
      const r = await fetch(`/api/hubs/${hubId}`)
      if (r.ok) {
        const data = await r.json()
        setFolders(data.folders)
        setItems(data.items)
        if (selectedFolderId === id || !data.folders.some((f: FolderNode) => f.id === selectedFolderId)) {
          setSelectedFolderId(folder.parentId)
        }
      }
    }
  }

  const handleCreateItem = async (data: { type: string; title: string; url?: string; content?: string }) => {
    const res = await fetch(`/api/hubs/${hubId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, folderId: selectedFolderId }),
    })
    if (res.ok) {
      const item = await res.json()
      setItems((prev) => [...prev, item])
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to add item')
    }
  }

  const handleUpdateItem = async (id: string, data: { title?: string; url?: string | null; content?: string | null }) => {
    const res = await fetch(`/api/hubs/${hubId}/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)))
    }
  }

  const handleDeleteItem = async (id: string) => {
    const res = await fetch(`/api/hubs/${hubId}/items/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems((prev) => prev.filter((it) => it.id !== id))
    }
  }

  const handleAddNote = async () => {
    const res = await fetch(`/api/hubs/${hubId}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    if (res.ok) {
      const note = await res.json()
      setNotes((prev) => [...prev, note])
    }
  }

  const handleUpdateNote = async (
    id: string,
    data: Partial<Pick<HubNote, 'title' | 'content' | 'linkedItemId' | 'visibility' | 'minimized'>>
  ) => {
    const res = await fetch(`/api/hubs/${hubId}/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)))
    }
  }

  const handleDeleteNote = async (id: string) => {
    const res = await fetch(`/api/hubs/${hubId}/notes/${id}`, { method: 'DELETE' })
    if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  const handleSetFolderPrivacy = async (id: string, data: PrivacyApply) => {
    const res = await fetch(`/api/hubs/${hubId}/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...updated } : f)))
    }
  }

  const handleSetItemPrivacy = async (id: string, data: PrivacyApply) => {
    const res = await fetch(`/api/hubs/${hubId}/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updated } : it)))
    }
  }

  if (loading) {
    return (
      <div className="px-6 lg:px-8 py-7">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!hub) return null

  return (
    <div className="px-6 lg:px-8 py-7">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 rounded-xl border border-border bg-surface px-2 py-1.5 shadow-soft">
        <button
          type="button"
          onClick={handleAddNote}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-muted/60"
        >
          <StickyNote className="w-4 h-4" /> Note
        </button>
        <button
          type="button"
          onClick={() => {
            if (isPro) setShowCollaborators(true)
            else setShowUpgrade(true)
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-muted/60"
        >
          <Users className="w-4 h-4" /> Collaborators
        </button>
        <button
          type="button"
          onClick={() => setShowCommunity((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-muted/60"
        >
          <UsersRound className="w-4 h-4" /> Community
        </button>
      </div>

      {/* Header */}
      <div className="mb-6 rounded-2xl border border-border bg-surface overflow-hidden shadow-soft">
        <div className="h-32 relative bg-gradient-to-br from-galli/20 to-galli-violet/20 group">
          {hub.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hub.coverImage} alt="" className="w-full h-full object-cover" />
          )}
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCover}
            className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-white text-sm gap-2"
          >
            {uploadingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            {uploadingCover ? 'Uploading…' : 'Change cover'}
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleCoverUpload(f)
            }}
          />
        </div>
        <div className="p-4 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== hub.title && patchHub({ title: title.trim() })}
            placeholder="Hub title"
            className="w-full text-xl font-bold bg-transparent focus:outline-none focus:ring-2 focus:ring-primary rounded-lg px-1 -mx-1"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (hub.description ?? '') && patchHub({ description })}
            placeholder="Add a description…"
            rows={2}
            className="w-full text-sm text-muted-foreground bg-transparent focus:outline-none focus:ring-2 focus:ring-primary rounded-lg px-1 -mx-1 resize-none"
          />
        </div>
      </div>

      {showCommunity && (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-soft">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Community</h2>
          <HubCommunityConsole hubId={hub.id} initialEnabled={hub.community} />
        </div>
      )}

      <div className="grid md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_260px] gap-6">
        {/* Folder tree */}
        <div className="rounded-2xl border border-border bg-surface p-3 shadow-soft h-fit">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Folders</h2>
          </div>
          <HubFolderTree tree={tree} selectedId={selectedFolderId} onSelect={setSelectedFolderId} />
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                placeholder="New folder"
                className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
                className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 shrink-0"
                title="Create folder"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>
            {selectedFolder && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">
                  {selectedFolder.visibility === 'private' ? 'Private folder' : 'Public folder'}
                </span>
                <HubPrivacyControl
                  visibility={selectedFolder.visibility}
                  hasPasscode={selectedFolder.hasPasscode}
                  isPro={isPro}
                  label="Folder privacy"
                  onApply={(data) => handleSetFolderPrivacy(selectedFolder.id, data)}
                />
              </div>
            )}
            {selectedFolderId && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleRenameFolder(selectedFolderId)}
                  className="flex-1 px-2 py-1.5 text-xs bg-muted rounded-lg hover:bg-muted/80"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteFolder(selectedFolderId)}
                  className="flex-1 px-2 py-1.5 text-xs bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Item list */}
        <div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
            <button type="button" onClick={() => setSelectedFolderId(null)} className="hover:text-foreground">
              Root
            </button>
            {breadcrumb.map((f) => (
              <span key={f.id} className="flex items-center gap-1.5">
                <ChevronRight className="w-3.5 h-3.5" />
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(f.id)}
                  className="hover:text-foreground"
                >
                  {f.name}
                </button>
              </span>
            ))}
          </div>
          <HubItemList
            items={visibleItems}
            isPro={isPro}
            onCreate={handleCreateItem}
            onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem}
            onSetPrivacy={handleSetItemPrivacy}
          />
        </div>

        {/* Notes panel */}
        <HubNotesPanel notes={notes} items={items} onUpdate={handleUpdateNote} onDelete={handleDeleteNote} />
      </div>

      {showCollaborators && (
        <HubCollaboratorsModal hubId={hubId} onClose={() => setShowCollaborators(false)} />
      )}
      <UpgradePrompt
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="Hub collaborators"
      />
    </div>
  )
}
