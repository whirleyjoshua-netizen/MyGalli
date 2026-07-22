// Folder-tree building lives in @/lib/hub-tree — FileFolder is deliberately
// shaped to feed its buildFolderTree rather than duplicating one here.

export type FileFolder = {
  id: string
  parentId: string | null
  name: string
  order: number
  locked: boolean
}

export type FileItem = {
  id: string
  folderId: string | null
  type: string
  title: string
  url: string | null
  order: number
  locked: boolean
}

/** Items directly inside `folderId`, in display order. `null` means the root. */
export function itemsInFolder(items: FileItem[], folderId: string | null): FileItem[] {
  return items
    .filter((i) => (i.folderId ?? null) === folderId)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
}
