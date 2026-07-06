import { describe, it, expect } from 'vitest'
import { layoutFlow, descendantIds } from './flowchart-layout'
import type { FlowNode } from './types/canvas'

const n = (id: string, parentId?: string, extra: Partial<FlowNode> = {}): FlowNode =>
  ({ id, title: id, parentId, ...extra })

describe('descendantIds', () => {
  it('collects all descendants, not the node itself', () => {
    const nodes = [n('a'), n('b', 'a'), n('c', 'b'), n('d', 'a')]
    expect(descendantIds(nodes, 'a')).toEqual(new Set(['b', 'c', 'd']))
    expect(descendantIds(nodes, 'b')).toEqual(new Set(['c']))
    expect(descendantIds(nodes, 'c')).toEqual(new Set())
  })

  it('never includes the queried node itself, even on a cycle', () => {
    const nodes = [n('a', 'b'), n('b', 'a')]
    expect(descendantIds(nodes, 'a').has('a')).toBe(false)
    expect(descendantIds(nodes, 'b').has('b')).toBe(false)
  })
})

describe('layoutFlow', () => {
  it('places a child below its parent', () => {
    const { nodes, edges } = layoutFlow([n('a'), n('b', 'a')])
    const a = nodes.find(x => x.id === 'a')!
    const b = nodes.find(x => x.id === 'b')!
    expect(b.y).toBeGreaterThan(a.y)
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ fromId: 'a', toId: 'b' })
  })

  it('centers a parent over its two children and keeps siblings apart', () => {
    const { nodes } = layoutFlow([n('p'), n('l', 'p'), n('r', 'p')])
    const p = nodes.find(x => x.id === 'p')!
    const l = nodes.find(x => x.id === 'l')!
    const r = nodes.find(x => x.id === 'r')!
    expect(l.x).not.toBe(r.x)              // siblings do not overlap
    const mid = (l.x + r.x) / 2
    expect(Math.abs(p.x - mid)).toBeLessThan(1) // parent centered
  })

  it('lays out a forest (two roots) without overlap and carries branch labels on edges', () => {
    const { nodes, edges } = layoutFlow([n('r1'), n('r2'), n('c', 'r1', { branchLabel: 'Yes' })])
    const r1 = nodes.find(x => x.id === 'r1')!
    const r2 = nodes.find(x => x.id === 'r2')!
    expect(r1.x).not.toBe(r2.x)
    expect(edges.find(e => e.toId === 'c')!.label).toBe('Yes')
  })

  it('treats a parentId pointing at a missing node as a root (no crash)', () => {
    const { nodes, edges } = layoutFlow([n('x', 'ghost')])
    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })

  it('breaks a two-node cycle: both become roots, no edges, no crash', () => {
    const { nodes, edges } = layoutFlow([n('a', 'b'), n('b', 'a')])
    expect(nodes).toHaveLength(2)
    expect(edges).toHaveLength(0)
  })

  it('treats a self-parent as a root with no edge', () => {
    const { nodes, edges } = layoutFlow([n('a', 'a')])
    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })
})
