import { describe, it, expect } from 'vitest'
import { buildFolderTree, folderPath } from './hub-tree'

const folders = [
  { id: 'a', parentId: null, name: 'A', order: 0 },
  { id: 'b', parentId: 'a', name: 'B', order: 0 },
  { id: 'c', parentId: 'a', name: 'C', order: 1 },
  { id: 'd', parentId: 'b', name: 'D', order: 0 },
]

describe('buildFolderTree', () => {
  it('nests children under parents, ordered', () => {
    const tree = buildFolderTree(folders)
    expect(tree.map((n) => n.id)).toEqual(['a'])
    expect(tree[0].children.map((n) => n.id)).toEqual(['b', 'c'])
    expect(tree[0].children[0].children.map((n) => n.id)).toEqual(['d'])
  })
})

describe('folderPath', () => {
  it('returns root→id breadcrumb', () => {
    expect(folderPath(folders, 'd').map((f) => f.id)).toEqual(['a', 'b', 'd'])
  })
  it('returns [] for unknown id', () => {
    expect(folderPath(folders, 'zzz')).toEqual([])
  })
})
