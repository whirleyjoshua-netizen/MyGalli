'use client'

import { useState } from 'react'
import { StickyNote, Trash2, ChevronDown, ChevronRight, Lock, Globe, ExternalLink, Pencil } from 'lucide-react'
import { linkableItems, resolveNoteLink } from '@/lib/hub-notes'
import type { HubItem } from './HubItemList'

export interface HubNote {
  id: string
  hubId: string
  title: string
  content: string
  linkedItemId: string | null
  visibility: string
  minimized: boolean
  order: number
  color: string
}

export type BookmarkLite = {
  id: string
  noteId: string
  itemId: string
  page: number
  rects: { x: number; y: number; w: number; h: number }[]
  title: string
}

const PALETTE = ['#FDE047', '#FCA5A5', '#93C5FD', '#86EFAC', '#C4B5FD', '#FDBA74']

interface HubNotesPanelProps {
  notes: HubNote[]
  items: HubItem[]
  onUpdate: (id: string, data: Partial<Pick<HubNote, 'title' | 'content' | 'linkedItemId' | 'visibility' | 'minimized' | 'color'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  bookmarks: BookmarkLite[]
  onOpenBookmark: (itemId: string, page: number) => void
  onRenameBookmark: (noteId: string, bookmarkId: string, title: string) => Promise<void>
  onDeleteBookmark: (noteId: string, bookmarkId: string) => Promise<void>
}

function NoteCard({
  note,
  items,
  onUpdate,
  onDelete,
  bookmarks,
  onOpenBookmark,
  onRenameBookmark,
  onDeleteBookmark,
}: {
  note: HubNote
  items: HubItem[]
  onUpdate: HubNotesPanelProps['onUpdate']
  onDelete: HubNotesPanelProps['onDelete']
  bookmarks: BookmarkLite[]
  onOpenBookmark: HubNotesPanelProps['onOpenBookmark']
  onRenameBookmark: HubNotesPanelProps['onRenameBookmark']
  onDeleteBookmark: HubNotesPanelProps['onDeleteBookmark']
}) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const linkable = linkableItems(items)
  const href = resolveNoteLink(note, items)
  const noteBookmarks = bookmarks.filter((b) => b.noteId === note.id)

  if (note.minimized) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
        <button
          type="button"
          onClick={() => onUpdate(note.id, { minimized: false })}
          className="p-0.5 rounded hover:bg-muted shrink-0"
          title="Expand"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <StickyNote className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate flex-1">{note.title || 'Untitled note'}</span>
        {note.visibility === 'private' && <Lock className="w-3 h-3 text-galli-violet shrink-0" aria-label="Private" />}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onUpdate(note.id, { minimized: true })}
          className="p-0.5 rounded hover:bg-muted shrink-0"
          title="Minimize"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <StickyNote className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <div className="relative shrink-0">
          <button
            type="button"
            title="Highlight color"
            onClick={() => setPaletteOpen((v) => !v)}
            className="w-4 h-4 rounded-full border border-border shrink-0"
            style={{ backgroundColor: note.color }}
          />
          {paletteOpen && (
            <div className="absolute left-0 top-full mt-1 z-10 flex gap-1 p-1.5 rounded-lg border border-border bg-surface shadow-soft-lg">
              {PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    onUpdate(note.id, { color })
                    setPaletteOpen(false)
                  }}
                  className="w-4 h-4 rounded-full border border-border"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== note.title && onUpdate(note.id, { title })}
          placeholder="Note title"
          className="flex-1 min-w-0 text-sm font-medium bg-transparent focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
        />
        <button
          type="button"
          onClick={() => {
            if (confirm('Delete this note?')) onDelete(note.id)
          }}
          className="p-1 rounded hover:bg-destructive/10 text-destructive shrink-0"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => content !== note.content && onUpdate(note.id, { content })}
        placeholder="Write a note…"
        rows={3}
        className="w-full text-sm bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
      />

      <select
        value={note.linkedItemId ?? ''}
        onChange={(e) => onUpdate(note.id, { linkedItemId: e.target.value || null })}
        className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">No linked item</option>
        {linkable.map((it) => (
          <option key={it.id} value={it.id}>
            {it.title}
          </option>
        ))}
      </select>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onUpdate(note.id, { visibility: note.visibility === 'private' ? 'public' : 'private' })}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          title="Toggle visibility"
        >
          {note.visibility === 'private' ? (
            <><Lock className="w-3 h-3 text-galli-violet" /> Private</>
          ) : (
            <><Globe className="w-3 h-3" /> Public</>
          )}
        </button>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {noteBookmarks.length > 0 && (
        <div className="pt-1 border-t border-border space-y-1">
          {noteBookmarks.map((b) => (
            <div key={b.id} className="flex items-center gap-1.5 group/bm">
              <button
                type="button"
                onClick={() => onOpenBookmark(b.itemId, b.page)}
                className="flex-1 min-w-0 text-left text-xs text-primary hover:underline truncate"
              >
                ↳ {b.title} · p.{b.page}
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = prompt('Rename bookmark', b.title)
                  if (t && t.trim()) onRenameBookmark(note.id, b.id, t.trim())
                }}
                className="opacity-0 group-hover/bm:opacity-100 p-0.5 rounded hover:bg-muted"
                title="Rename"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete bookmark?')) onDeleteBookmark(note.id, b.id)
                }}
                className="opacity-0 group-hover/bm:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-destructive"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function HubNotesPanel({
  notes,
  items,
  onUpdate,
  onDelete,
  bookmarks,
  onOpenBookmark,
  onRenameBookmark,
  onDeleteBookmark,
}: HubNotesPanelProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 shadow-soft h-fit">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Notes ({notes.length})
      </h2>
      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          Add a note from the toolbar. Notes can link to any file, link, or embed in this hub.
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              items={items}
              onUpdate={onUpdate}
              onDelete={onDelete}
              bookmarks={bookmarks}
              onOpenBookmark={onOpenBookmark}
              onRenameBookmark={onRenameBookmark}
              onDeleteBookmark={onDeleteBookmark}
            />
          ))}
        </div>
      )}
    </div>
  )
}
