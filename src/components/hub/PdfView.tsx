'use client'

import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { Loader2, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { selectionRectsToPdf, pdfRectsToStyle, type Rect } from '@/lib/hub-highlight'
import { PdfBookmarkStrip } from './PdfBookmarkStrip'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

type BookmarkLite = { id: string; noteId: string; itemId: string; page: number; rects: Rect[]; title: string }
type NoteLite = { id: string; title: string; color: string }

interface PdfViewProps {
  url: string
  initialPage?: number
  itemId?: string
  editable?: boolean
  notes?: NoteLite[]
  noteColors?: Record<string, string>
  bookmarks?: BookmarkLite[]
  onCreateBookmark?: (input: { noteId: string; itemId: string; page: number; rects: Rect[]; text: string; title: string }) => Promise<void>
  onCreateNote?: () => Promise<string | null>
}

export default function PdfView({ url, initialPage = 1, itemId, editable, notes = [], noteColors = {}, bookmarks = [], onCreateBookmark, onCreateNote }: PdfViewProps) {
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [scale, setScale] = useState(1.2)
  const [error, setError] = useState(false)
  const pageWrapRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<{ rects: Rect[]; text: string; left: number; top: number } | null>(null)
  const [draftSeq, setDraftSeq] = useState(0)

  useEffect(() => { setDraft(null) }, [page])

  const btn = 'p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white'
  const pageBookmarks = bookmarks.filter((b) => b.page === page)

  const handleMouseUp = () => {
    if (!editable || !onCreateBookmark) return
    const sel = window.getSelection()
    const wrap = pageWrapRef.current
    if (!sel || sel.isCollapsed || !wrap) { setDraft(null); return }
    const text = sel.toString().trim()
    if (!text) { setDraft(null); return }
    const range = sel.getRangeAt(0)
    if (!wrap.contains(range.commonAncestorContainer)) return
    const wrapRect = wrap.getBoundingClientRect()
    const clientRects = Array.from(range.getClientRects()).map((r) => ({ left: r.left, top: r.top, width: r.width, height: r.height }))
    if (!clientRects.length) return
    const rects = selectionRectsToPdf(clientRects, { left: wrapRect.left, top: wrapRect.top }, scale)
    const last = clientRects[clientRects.length - 1]
    setDraft({ rects, text, left: last.left - wrapRect.left, top: last.top - wrapRect.top + last.height + 4 })
    setDraftSeq((n) => n + 1)
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center gap-2 text-sm text-white">
        <button type="button" className={btn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
        <span className="tabular-nums">{page} / {numPages || '…'}</span>
        <button type="button" className={btn} onClick={() => setPage((p) => Math.min(numPages || p, p + 1))} disabled={!!numPages && page >= numPages} aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
        <span className="mx-1 w-px h-4 bg-white/20" />
        <button type="button" className={btn} onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)))} aria-label="Zoom out"><Minus className="w-4 h-4" /></button>
        <button type="button" className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs" onClick={() => setScale(1.2)}>Reset</button>
        <button type="button" className={btn} onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(2)))} aria-label="Zoom in"><Plus className="w-4 h-4" /></button>
      </div>

      {/* Every mark in this file, not just the current page's — with no notes
          panel on the community Files tab, this is the only way to discover
          highlights that live on other pages. */}
      <PdfBookmarkStrip bookmarks={bookmarks} noteColors={noteColors} onJump={setPage} />

      {error ? (
        <p className="text-sm text-white/80 mt-6">Couldn&apos;t render this PDF — use Download instead.</p>
      ) : (
        <div className="overflow-auto max-h-[80vh] rounded-lg bg-white">
          <Document file={url} onLoadSuccess={({ numPages }) => setNumPages(numPages)} onLoadError={() => setError(true)} loading={<div className="p-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
            <div ref={pageWrapRef} className="relative inline-block" onMouseUp={handleMouseUp}>
              <Page pageNumber={page} scale={scale} renderTextLayer renderAnnotationLayer={false} />
              {/* highlight overlays */}
              {pageBookmarks.map((b) =>
                pdfRectsToStyle(b.rects, scale).map((s, i) => (
                  <div key={`${b.id}-${i}`} className="absolute pointer-events-none rounded-sm" style={{ left: s.left, top: s.top, width: s.width, height: s.height, backgroundColor: noteColors[b.noteId] ?? '#FDE047', opacity: 0.35 }} />
                ))
              )}
              {/* selection popover */}
              {draft && editable && (
                <SelectionPopover
                  key={draftSeq}
                  left={draft.left}
                  top={draft.top}
                  notes={notes}
                  defaultTitle={draft.text}
                  onCancel={() => setDraft(null)}
                  onSave={async (noteChoice, title) => {
                    try {
                      let noteId = noteChoice
                      if (noteChoice === '__new__') {
                        const created = onCreateNote ? await onCreateNote() : null
                        if (!created) return
                        noteId = created
                      }
                      if (itemId && onCreateBookmark) {
                        await onCreateBookmark({ noteId, itemId, page, rects: draft.rects, text: draft.text, title })
                      }
                    } finally {
                      setDraft(null)
                      window.getSelection()?.removeAllRanges()
                    }
                  }}
                />
              )}
            </div>
          </Document>
        </div>
      )}
    </div>
  )
}

function SelectionPopover({ left, top, notes, defaultTitle, onCancel, onSave }: {
  left: number; top: number; notes: NoteLite[]; defaultTitle: string
  onCancel: () => void; onSave: (noteId: string, title: string) => void | Promise<void>
}) {
  const [noteId, setNoteId] = useState(notes[0]?.id ?? '__new__')
  const [title, setTitle] = useState(defaultTitle.slice(0, 80))
  const [saving, setSaving] = useState(false)
  return (
    <div className="absolute z-10 w-64 rounded-xl border border-border bg-surface shadow-soft-lg p-2 space-y-2" style={{ left, top }} onMouseUp={(e) => e.stopPropagation()}>
      <p className="text-xs font-semibold text-muted-foreground px-1">Add bookmark</p>
      <select value={noteId} onChange={(e) => setNoteId(e.target.value)} className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5">
        {notes.map((n) => <option key={n.id} value={n.id}>{n.title || 'Untitled note'}</option>)}
        <option value="__new__">+ New note</option>
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bookmark title" className="w-full text-sm bg-background border border-border rounded-lg px-2 py-1.5" autoFocus />
      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={async () => { setSaving(true); await onSave(noteId, title.trim() || defaultTitle.slice(0, 80) || 'Bookmark') }} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50">Save</button>
        <button type="button" onClick={() => { window.getSelection()?.removeAllRanges(); onCancel() }} className="px-3 py-1.5 text-xs bg-muted rounded-lg hover:bg-muted/80">Cancel</button>
      </div>
    </div>
  )
}
