import { sign, verify } from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth'

export type Viewer = 'owner' | 'collaborator' | 'public'
export type NodeStatus = 'visible' | 'locked' | 'hidden'

interface Node { id: string; visibility?: string | null; hasPasscode?: boolean }
export interface AccessFolder extends Node { parentId: string | null }
export interface AccessItem extends Node { folderId: string | null }

export function resolveHubVisibility(input: {
  folders: AccessFolder[]
  items: AccessItem[]
  viewer: Viewer
  unlockedIds: Set<string>
}): Map<string, NodeStatus> {
  const { folders, items, viewer, unlockedIds } = input
  const out = new Map<string, NodeStatus>()
  if (viewer === 'owner' || viewer === 'collaborator') {
    folders.forEach((f) => out.set(f.id, 'visible'))
    items.forEach((i) => out.set(i.id, 'visible'))
    return out
  }
  const byId = new Map(folders.map((f) => [f.id, f]))
  // chain root→self (ancestors first, then self)
  const chainRootToSelf = (self: Node, parentId: string | null): Node[] => {
    const anc: Node[] = []
    const seen = new Set<string>()
    let cur = parentId ? byId.get(parentId) : undefined
    while (cur && !seen.has(cur.id)) { seen.add(cur.id); anc.push(cur); cur = cur.parentId ? byId.get(cur.parentId) : undefined }
    anc.reverse() // root-first
    return [...anc, self]
  }
  const statusFor = (chain: Node[]): NodeStatus => {
    // outermost private node that isn't unlocked blocks
    let blocker: Node | null = null
    for (const n of chain) {
      if (n.visibility === 'private' && !unlockedIds.has(n.id)) { blocker = n; break }
    }
    if (!blocker) return 'visible'
    const self = chain[chain.length - 1]
    if (blocker.id === self.id) return self.hasPasscode ? 'locked' : 'hidden'
    return 'hidden'
  }
  folders.forEach((f) => out.set(f.id, statusFor(chainRootToSelf(f, f.parentId))))
  items.forEach((i) => out.set(i.id, statusFor(chainRootToSelf(i, i.folderId))))
  return out
}

export function signUnlockToken(hubId: string, unlocked: string[]): string {
  return sign({ hubId, unlocked }, getJwtSecret(), { expiresIn: '12h' })
}
export function readUnlockToken(token: string | undefined, hubId: string): string[] {
  if (!token) return []
  try {
    const d = verify(token, getJwtSecret()) as { hubId?: string; unlocked?: string[] }
    if (d.hubId !== hubId || !Array.isArray(d.unlocked)) return []
    return d.unlocked.filter((x) => typeof x === 'string')
  } catch { return [] }
}
