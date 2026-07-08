'use client'

import { useRef, useState } from 'react'
import { File, Link as LinkIcon, Code2, StickyNote, Plus, Trash2, Pencil, Loader2, X, Lock, Eye } from 'lucide-react'
import { HubPrivacyControl, type PrivacyApply } from './HubPrivacyControl'
import { fileKind } from '@/lib/hub-file-kind'

export interface HubItem {
  id: string
  hubId: string
  folderId: string | null
  type: string
  title: string
  url: string | null
  content: string | null
  order: number
  visibility?: string | null
  hasPasscode?: boolean
}

interface HubItemListProps {
  items: HubItem[]
  isPro: boolean
  onCreate: (data: { type: string; title: string; url?: string; content?: string }) => Promise<void>
  onUpdate: (id: string, data: { title?: string; url?: string | null; content?: string | null }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSetPrivacy: (id: string, data: PrivacyApply) => Promise<void>
  onView: (item: HubItem) => void
}

const TYPE_ICON: Record<string, typeof File> = {
  file: File,
  link: LinkIcon,
  embed: Code2,
  note: StickyNote,
}

function AddForm({
  type,
  onCancel,
  onSubmit,
}: {
  type: 'file' | 'link' | 'embed' | 'note'
  onCancel: () => void
  onSubmit: (data: { title: string; url?: string; content?: string }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [content, setContent] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Upload failed')
      }
      const data = await res.json()
      setUrl(data.url)
      if (!title) setTitle(file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (type === 'note') {
      if (!content.trim()) {
        setError('Content is required')
        return
      }
    } else if (!url.trim()) {
      setError(type === 'file' ? 'Upload a file first' : 'URL is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ title: title.trim(), url: url.trim() || undefined, content: content.trim() || undefined })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add item')
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 mb-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add {type}</p>
        <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-muted">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        autoFocus
      />
      {type === 'file' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80 flex items-center gap-1.5"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {url ? 'Replace file' : 'Choose file'}
          </button>
          {url && <span className="text-xs text-muted-foreground truncate">Uploaded</span>}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
        </div>
      )}
      {(type === 'link' || type === 'embed') && (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={type === 'embed' ? 'https://example.com/embed' : 'https://example.com'}
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}
      {type === 'note' && (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Note content"
          rows={3}
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || uploading}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add'}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80">
          Cancel
        </button>
      </div>
    </div>
  )
}

function ItemRow({
  item,
  isPro,
  onUpdate,
  onDelete,
  onSetPrivacy,
  onView,
}: {
  item: HubItem
  isPro: boolean
  onUpdate: (id: string, data: { title?: string; url?: string | null; content?: string | null }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSetPrivacy: (id: string, data: PrivacyApply) => Promise<void>
  onView: (item: HubItem) => void
}) {
  const Icon = TYPE_ICON[item.type] ?? File
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [url, setUrl] = useState(item.url ?? '')
  const [content, setContent] = useState(item.content ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await onUpdate(item.id, {
        title: title.trim() || item.title,
        url: item.type === 'note' ? undefined : url,
        content: item.type === 'note' ? content : undefined,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {item.type !== 'note' ? (
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 group">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium truncate">
          <span className="truncate">{item.title}</span>
          {item.visibility === 'private' && (
            <Lock className="w-3 h-3 shrink-0 text-galli-violet" aria-label="Private" />
          )}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {item.type}
          {item.url ? ` · ${item.url}` : ''}
        </p>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <HubPrivacyControl
          visibility={item.visibility}
          hasPasscode={item.hasPasscode}
          isPro={isPro}
          label="Item privacy"
          onApply={(data) => onSetPrivacy(item.id, data)}
        />
      </div>
      {fileKind(item) !== 'other' && (
        <button
          type="button"
          onClick={() => onView(item)}
          className="p-1.5 rounded-lg hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
          title="View"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="p-1.5 rounded-lg hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
        title="Edit"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm(`Delete "${item.title}"?`)) onDelete(item.id)
        }}
        className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function HubItemList({ items, isPro, onCreate, onUpdate, onDelete, onSetPrivacy, onView }: HubItemListProps) {
  const [addType, setAddType] = useState<'file' | 'link' | 'embed' | 'note' | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-3 relative">
        <h2 className="text-sm font-semibold text-muted-foreground">Items ({items.length})</h2>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-36 rounded-lg border border-border bg-surface shadow-soft-lg z-10 overflow-hidden">
              {(['file', 'link', 'embed', 'note'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setAddType(t)
                    setMenuOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 capitalize"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {addType && (
        <AddForm
          type={addType}
          onCancel={() => setAddType(null)}
          onSubmit={async (data) => {
            await onCreate({ type: addType, ...data })
            setAddType(null)
          }}
        />
      )}

      {items.length === 0 && !addType ? (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <p className="text-sm text-muted-foreground">No items in this folder yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              isPro={isPro}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onSetPrivacy={onSetPrivacy}
              onView={onView}
            />
          ))}
        </div>
      )}
    </div>
  )
}
