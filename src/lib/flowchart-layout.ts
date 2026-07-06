import type { FlowNode } from './types/canvas'

export interface LaidOutNode { id: string; x: number; y: number; w: number; h: number; node: FlowNode }
export interface LaidOutEdge {
  fromId: string; toId: string; label?: string
  x1: number; y1: number; x2: number; y2: number
}
export interface FlowLayout { nodes: LaidOutNode[]; edges: LaidOutEdge[]; width: number; height: number }

const DEFAULTS = { nodeW: 190, nodeH: 76, gapX: 28, gapY: 56 }

// Map parentId -> children ids, ignoring parents that don't exist or self-loops.
function childMap(nodes: FlowNode[]): { children: Map<string, string[]>; roots: string[] } {
  const ids = new Set(nodes.map((x) => x.id))
  const children = new Map<string, string[]>()
  const roots: string[] = []
  for (const node of nodes) {
    const p = node.parentId
    if (!p || p === node.id || !ids.has(p)) {
      roots.push(node.id)
      continue
    }
    const arr = children.get(p) ?? []
    arr.push(node.id)
    children.set(p, arr)
  }
  return { children, roots }
}

/** All descendants of `id` (excludes `id` itself). Used for cycle prevention. */
export function descendantIds(nodes: FlowNode[], id: string): Set<string> {
  const { children } = childMap(nodes)
  const out = new Set<string>()
  const stack = [...(children.get(id) ?? [])]
  while (stack.length) {
    const cur = stack.pop() as string
    if (out.has(cur)) continue
    out.add(cur)
    for (const c of children.get(cur) ?? []) stack.push(c)
  }
  return out
}

/** Tidy top-down tree layout. Pure and deterministic. */
export function layoutFlow(nodes: FlowNode[], opts?: Partial<typeof DEFAULTS>): FlowLayout {
  const cfg = { ...DEFAULTS, ...opts }
  const { children, roots } = childMap(nodes)
  const pos = new Map<string, { x: number; y: number }>()
  const visited = new Set<string>()
  let nextLeaf = 0

  const place = (id: string, depth: number): number => {
    if (visited.has(id)) {
      const x = nextLeaf * (cfg.nodeW + cfg.gapX)
      nextLeaf++
      pos.set(id, { x, y: depth * (cfg.nodeH + cfg.gapY) })
      return x
    }
    visited.add(id)
    const kids = children.get(id) ?? []
    let x: number
    if (kids.length === 0) {
      x = nextLeaf * (cfg.nodeW + cfg.gapX)
      nextLeaf++
    } else {
      const xs = kids.map((k) => place(k, depth + 1))
      x = (xs[0] + xs[xs.length - 1]) / 2
    }
    pos.set(id, { x, y: depth * (cfg.nodeH + cfg.gapY) })
    return x
  }

  for (const r of roots) place(r, 0)
  for (const node of nodes) if (!visited.has(node.id)) place(node.id, 0) // orphans/cycles

  const laid: LaidOutNode[] = nodes.map((node) => {
    const p = pos.get(node.id) as { x: number; y: number }
    return { id: node.id, x: p.x, y: p.y, w: cfg.nodeW, h: cfg.nodeH, node }
  })
  const byId = new Map(laid.map((l) => [l.id, l]))

  const edges: LaidOutEdge[] = []
  for (const node of nodes) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    if (!parent || node.parentId === node.id) continue
    const child = byId.get(node.id) as LaidOutNode
    edges.push({
      fromId: parent.id,
      toId: child.id,
      label: node.branchLabel,
      x1: parent.x + cfg.nodeW / 2,
      y1: parent.y + cfg.nodeH,
      x2: child.x + cfg.nodeW / 2,
      y2: child.y,
    })
  }

  const width = laid.reduce((m, node) => Math.max(m, node.x + node.w), 0)
  const height = laid.reduce((m, node) => Math.max(m, node.y + node.h), 0)
  return { nodes: laid, edges, width, height }
}
