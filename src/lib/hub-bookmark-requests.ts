import type { Rect } from '@/lib/hub-highlight'

/**
 * Shared by the Files tab and the community view. Structurally identical to the
 * local BookmarkLite in PdfView and HubFileViewer, so it passes straight in.
 */
export type BookmarkLite = {
  id: string
  noteId: string
  itemId: string
  page: number
  rects: Rect[]
  title: string
}

const TITLE_MAX = 200 // matches the notes route's slice(0, 200)

/**
 * Body for a note created by highlighting inside the file viewer.
 *
 * `visibility` is sent explicitly rather than relying on the route's default:
 * every highlight under a non-public note is invisible to members, so the whole
 * feature depends on it. The title matters because this note also appears in
 * the Home tab's Notes card — an empty title shows there as a blank entry.
 */
export function newNoteBody(fileTitle: string): { title: string; content: string; visibility: 'public' } {
  return { title: `Notes on ${fileTitle}`.slice(0, TITLE_MAX), content: '', visibility: 'public' }
}

export function bookmarkUrl(hubId: string, noteId: string): string {
  return `/api/hubs/${hubId}/notes/${noteId}/bookmarks`
}
