import { describe, it, expect } from 'vitest'
import { buildFolderTree } from '@/lib/hub-tree'
import { itemsInFolder, type FileFolder, type FileItem } from './hub-files-view'

const f = (id: string, parentId: string | null, order = 0): FileFolder =>
  ({ id, parentId, name: id, order, locked: false })
const i = (id: string, folderId: string | null, order = 0): FileItem =>
  ({ id, folderId, type: 'file', title: id, url: null, order, locked: false })

describe('FileFolder feeds the existing tree builder', () => {
  // Guards the structural compatibility the Files tab depends on: if FileFolder
  // or hub-tree's FolderNode drift apart, this fails instead of the Files tab.
  it('nests and orders through buildFolderTree', () => {
    const tree = buildFolderTree([f('b', null, 1), f('a', null, 0), f('a1', 'a')])
    expect(tree.map((n) => n.id)).toEqual(['a', 'b'])
    expect(tree[0].children.map((n) => n.id)).toEqual(['a1'])
  })

  it('promotes a visibility-orphaned folder to the root instead of dropping it', () => {
    expect(buildFolderTree([f('orphan', 'hidden-parent')]).map((n) => n.id)).toEqual(['orphan'])
  })
})

describe('itemsInFolder', () => {
  it('returns only that folder, ordered', () => {
    expect(itemsInFolder([i('b', 'f1', 1), i('a', 'f1', 0), i('c', 'f2')], 'f1').map((x) => x.id))
      .toEqual(['a', 'b'])
  })

  it('treats null as the root folder', () => {
    expect(itemsInFolder([i('root', null), i('nested', 'f1')], null).map((x) => x.id)).toEqual(['root'])
  })
})
