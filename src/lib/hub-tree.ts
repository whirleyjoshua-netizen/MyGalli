export interface FolderNode { id: string; parentId: string | null; name: string; order: number }
export interface TreeNode extends FolderNode { children: TreeNode[] }

export function buildFolderTree(folders: FolderNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  folders.forEach((f) => byId.set(f.id, { ...f, children: [] }))
  const roots: TreeNode[] = []
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node)
    else roots.push(node)
  })
  const sort = (ns: TreeNode[]) => { ns.sort((a, b) => a.order - b.order); ns.forEach((n) => sort(n.children)) }
  sort(roots)
  return roots
}

export function folderPath(folders: FolderNode[], id: string): FolderNode[] {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const path: FolderNode[] = []
  let cur = byId.get(id)
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    path.unshift(cur)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return byId.has(id) ? path : []
}

export function descendantFolderIds(folders: FolderNode[], rootId: string): string[] {
  const out = [rootId]
  const kids = folders.filter((f) => f.parentId === rootId)
  for (const k of kids) out.push(...descendantFolderIds(folders, k.id))
  return out
}
