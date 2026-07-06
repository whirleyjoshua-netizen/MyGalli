'use client'

import { useMemo, useState } from 'react'
import { Folder, File, Link as LinkIcon, Code2, StickyNote, ChevronRight, X } from 'lucide-react'
import { buildFolderTree, folderPath, type FolderNode } from '@/lib/hub-tree'
import { safeHref } from '@/lib/editor/safe-href'

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
}

interface HubViewerProps {
  hub: HubViewerHub
  folders: FolderNode[]
  items: HubViewerItem[]
  username: string
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

function ItemCard({ item }: { item: HubViewerItem }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const Icon = TYPE_ICON[item.type] ?? File
  const href = safeHref(item.url ?? undefined)

  if (item.type === 'image') {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
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
        {lightboxOpen && href && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={href} alt={item.title} className="max-w-full max-h-full rounded-lg" />
          </div>
        )}
      </>
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

  // audio / video / file / pdf / link → Open link
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.title}</p>
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90"
        >
          Open
        </a>
      )}
    </div>
  )
}

export function HubViewer({ hub, folders, items, username }: HubViewerProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

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
    <div className="max-w-3xl mx-auto px-4 py-10">
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
          {filteredSubfolders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setCurrentFolderId(f.id)}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 hover:border-galli/50 transition text-left"
            >
              <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{f.name}</span>
            </button>
          ))}
        </div>
      )}

      {filteredItems.length > 0 ? (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : filteredSubfolders.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        </div>
      ) : null}
    </div>
  )
}
