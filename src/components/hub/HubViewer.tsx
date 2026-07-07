'use client'

import { useMemo, useState } from 'react'
import { Folder, File, Link as LinkIcon, Code2, StickyNote, ChevronRight, ChevronDown, Eye, Lock, ExternalLink } from 'lucide-react'
import { buildFolderTree, folderPath, type FolderNode } from '@/lib/hub-tree'
import { safeHref } from '@/lib/editor/safe-href'
import { HubCommunitySection } from './HubCommunitySection'
import { resolveNoteLink } from '@/lib/hub-notes'
import { HubFileViewer } from './HubFileViewer'
import { fileKind } from '@/lib/hub-file-kind'

export interface HubViewerHub {
  id: string
  title: string
  description: string | null
  coverImage: string | null
}

export interface HubViewerItem {
  id: string
  hubId: string
  folderId: string | null
  type: string
  title: string
  url: string | null
  content?: string | null
  order: number
  locked?: boolean
}

type HubViewerFolder = FolderNode & { locked?: boolean }

export interface HubViewerNote {
  id: string
  title: string
  content: string
  linkedItemId: string | null
  minimized: boolean
}

interface HubViewerProps {
  hub: HubViewerHub
  folders: HubViewerFolder[]
  items: HubViewerItem[]
  notes: HubViewerNote[]
  username: string
  hubId?: string
  community?: { isCommunity: boolean; joined: boolean; memberCount: number; canPost: boolean }
  currentUserId?: string
}

const TYPE_ICON: Record<string, typeof File> = {
  file: File,
  link: LinkIcon,
  embed: Code2,
  note: StickyNote,
  image: File,
  audio: File,
  video: File,
  pdf: File,
}

function UnlockPrompt({ hubId, nodeId }: { hubId: string; nodeId: string }) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleUnlock = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/hubs/${hubId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, passcode }),
      })
      if (res.status === 401) {
        setError('Incorrect passcode')
        setSubmitting(false)
        return
      }
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        location.reload()
      } else {
        setError('Incorrect passcode')
        setSubmitting(false)
      }
    } catch {
      setError('Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        type="password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        placeholder="Enter passcode"
        className="flex-1 px-2 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <button
        type="button"
        onClick={handleUnlock}
        disabled={submitting}
        className="shrink-0 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
      >
        Unlock
      </button>
      {error && <p className="text-xs text-red-500 shrink-0">{error}</p>}
    </div>
  )
}

function ItemCard({ item, hubId, onView }: { item: HubViewerItem; hubId?: string; onView: (item: HubViewerItem) => void }) {
  const [unlockOpen, setUnlockOpen] = useState(false)

  if (item.locked) {
    return (
      <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
        <button
          type="button"
          onClick={() => setUnlockOpen((v) => !v)}
          className="flex items-center gap-3 w-full text-left"
        >
          <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{item.title}</p>
          </div>
        </button>
        {unlockOpen && hubId && <UnlockPrompt hubId={hubId} nodeId={item.id} />}
      </div>
    )
  }

  const Icon = TYPE_ICON[item.type] ?? File
  const href = safeHref(item.url ?? undefined)
  const kind = fileKind(item)

  if (kind === 'image') {
    return (
      <button
        type="button"
        onClick={() => onView(item)}
        className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left w-full hover:border-galli/50 transition"
      >
        {href ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={href} alt={item.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
        ) : (
          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{item.title}</p>
        </div>
      </button>
    )
  }

  if (item.type === 'embed') {
    return (
      <div className="rounded-xl border border-border bg-surface p-3">
        <p className="text-sm font-medium mb-2">{item.title}</p>
        {href ? (
          <iframe
            src={href}
            className="w-full aspect-video rounded-lg border border-border"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        ) : (
          <p className="text-xs text-muted-foreground">No embed URL</p>
        )}
      </div>
    )
  }

  if (item.type === 'note') {
    return (
      <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
        <p className="text-sm font-medium mb-1">{item.title}</p>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.content}</p>
      </div>
    )
  }

  // pdf → View in-app; audio / video / other file / link → Open
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.title}</p>
      </div>
      {kind === 'pdf' ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onView(item)}
            className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 inline-flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </button>
          {href && (
            <a href={href} download target="_blank" rel="noopener noreferrer" className="px-2 py-1.5 text-xs font-medium bg-muted rounded-lg hover:bg-muted/80">
              Download
            </a>
          )}
        </div>
      ) : (
        href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            Open
          </a>
        )
      )}
    </div>
  )
}

function NotesRail({ notes, items }: { notes: HubViewerNote[]; items: HubViewerItem[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  if (notes.length === 0) return null
  return (
    <aside className="lg:w-64 shrink-0 space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <StickyNote className="w-3.5 h-3.5" /> Notes
      </h2>
      {notes.map((note) => {
        const expanded = open[note.id] ?? !note.minimized
        const href = resolveNoteLink(note, items)
        return (
          <div key={note.id} className="rounded-xl border border-border bg-surface p-3">
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, [note.id]: !expanded }))}
              className="flex items-center gap-1.5 w-full text-left"
            >
              {expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
              <span className="text-sm font-medium truncate">{note.title || 'Note'}</span>
            </button>
            {expanded && (
              <div className="mt-2 space-y-2">
                {note.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>}
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        )
      })}
    </aside>
  )
}

export function HubViewer({ hub, folders, items, notes, username, hubId, community, currentUserId }: HubViewerProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [unlockFolderId, setUnlockFolderId] = useState<string | null>(null)
  const [viewerFile, setViewerFile] = useState<HubViewerItem | null>(null)

  const tree = useMemo(() => buildFolderTree(folders), [folders])
  const breadcrumb = useMemo(
    () => (currentFolderId ? folderPath(folders, currentFolderId) : []),
    [folders, currentFolderId]
  )

  const subfolders = useMemo(
    () => folders.filter((f) => (f.parentId ?? null) === currentFolderId).sort((a, b) => a.order - b.order),
    [folders, currentFolderId]
  )

  const currentItems = useMemo(
    () => items.filter((i) => (i.folderId ?? null) === currentFolderId).sort((a, b) => a.order - b.order),
    [items, currentFolderId]
  )

  const q = query.trim().toLowerCase()
  const filteredSubfolders = q ? subfolders.filter((f) => f.name.toLowerCase().includes(q)) : subfolders
  const filteredItems = q ? currentItems.filter((i) => i.title.toLowerCase().includes(q)) : currentItems

  void tree // reserved for future full-tree sidebar

  return (
    <div className={`${notes.length > 0 ? 'max-w-5xl' : 'max-w-3xl'} mx-auto px-4 py-10 flex flex-col lg:flex-row gap-8 items-start`}>
      <div className="flex-1 min-w-0 w-full">
      <header className="mb-8 text-center">
        {hub.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hub.coverImage}
            alt=""
            className="w-full h-40 object-cover rounded-2xl mb-4"
          />
        )}
        <h1 className="text-3xl font-bold mb-1">{hub.title}</h1>
        {hub.description && <p className="text-muted-foreground">{hub.description}</p>}
        <p className="mt-2 text-sm text-muted-foreground">
          by{' '}
          <a href={`/${username}`} className="hover:underline">
            {username}
          </a>
        </p>
      </header>

      <nav className="flex items-center flex-wrap gap-1 text-sm mb-4 text-muted-foreground">
        <button
          type="button"
          onClick={() => setCurrentFolderId(null)}
          className={currentFolderId === null ? 'font-semibold text-foreground' : 'hover:underline'}
        >
          Home
        </button>
        {breadcrumb.map((f) => (
          <span key={f.id} className="flex items-center gap-1">
            <ChevronRight className="w-3.5 h-3.5" />
            <button
              type="button"
              onClick={() => setCurrentFolderId(f.id)}
              className={f.id === currentFolderId ? 'font-semibold text-foreground' : 'hover:underline'}
            >
              {f.name}
            </button>
          </span>
        ))}
      </nav>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search this folder…"
        className="w-full mb-6 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {filteredSubfolders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
          {filteredSubfolders.map((f) =>
            f.locked ? (
              <div key={f.id} className="rounded-xl border border-border bg-surface px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setUnlockFolderId((cur) => (cur === f.id ? null : f.id))}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{f.name}</span>
                </button>
                {unlockFolderId === f.id && hubId && <UnlockPrompt hubId={hubId} nodeId={f.id} />}
              </div>
            ) : (
              <button
                key={f.id}
                type="button"
                onClick={() => setCurrentFolderId(f.id)}
                className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 hover:border-galli/50 transition text-left"
              >
                <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate">{f.name}</span>
              </button>
            )
          )}
        </div>
      )}

      {filteredItems.length > 0 ? (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <ItemCard key={item.id} item={item} hubId={hubId} onView={setViewerFile} />
          ))}
        </div>
      ) : filteredSubfolders.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        </div>
      ) : null}

      {community?.isCommunity && hubId && (
        <HubCommunitySection
          hubId={hubId}
          initialJoined={community.joined}
          memberCount={community.memberCount}
          canPost={community.canPost}
          currentUserId={currentUserId}
        />
      )}
      </div>
      <NotesRail notes={notes} items={items} />
      <HubFileViewer file={viewerFile} onClose={() => setViewerFile(null)} />
    </div>
  )
}
