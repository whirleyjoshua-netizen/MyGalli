export interface Rect { x: number; y: number; w: number; h: number }

export function selectionRectsToPdf(
  clientRects: { left: number; top: number; width: number; height: number }[],
  pageRect: { left: number; top: number },
  scale: number
): Rect[] {
  return clientRects.map((r) => ({
    x: (r.left - pageRect.left) / scale,
    y: (r.top - pageRect.top) / scale,
    w: r.width / scale,
    h: r.height / scale,
  }))
}

export function pdfRectsToStyle(rects: Rect[], scale: number) {
  return rects.map((r) => ({ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale }))
}

export function visibleBookmarks<B extends { noteId: string }>(
  bookmarks: B[],
  noteVisibility: Record<string, string>,
  isOwner: boolean
): B[] {
  if (isOwner) return bookmarks
  return bookmarks.filter((b) => noteVisibility[b.noteId] === 'public')
}

export function bookmarkColor(noteId: string, noteColors: Record<string, string>, fallback = '#FDE047'): string {
  return noteColors[noteId] ?? fallback
}
