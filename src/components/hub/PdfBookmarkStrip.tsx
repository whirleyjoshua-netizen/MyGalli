'use client'

export type StripBookmark = { id: string; noteId: string; page: number; title: string }

const DEFAULT_COLOR = '#FDE047'

/**
 * Page jumps for a file's highlights.
 *
 * Renders nothing when the file has none, so data-rooms without bookmarks look
 * exactly as they did before this existed.
 */
export function PdfBookmarkStrip({
  bookmarks, noteColors = {}, onJump,
}: {
  bookmarks: StripBookmark[]
  noteColors?: Record<string, string>
  onJump: (page: number) => void
}) {
  if (bookmarks.length === 0) return null
  const ordered = [...bookmarks].sort((a, b) => a.page - b.page)

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 text-white/80">
      <span className="text-xs uppercase tracking-wide text-white/50">Marks</span>
      {ordered.map((b) => (
        <button
          key={b.id}
          type="button"
          aria-label={`Jump to page ${b.page}`}
          title={b.title}
          onClick={() => onJump(b.page)}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: noteColors[b.noteId] ?? DEFAULT_COLOR }}
          />
          p{b.page}
        </button>
      ))}
    </div>
  )
}
