import { describe, it, expect } from 'vitest'
import { hydrateCollectionElements } from './collections-hydrate'
import type { Section } from '@/lib/types/canvas'
import type { CollectionMemberCard } from '@/lib/collections'

const cards: CollectionMemberCard[] = [
  { id: 'm1', username: 'coach', slug: 'a', title: 'A', description: null, coverImage: null, category: null },
]

function sectionsWith(type: string): Section[] {
  return [{ id: 's1', layout: 'full-width', columns: [{ id: 'c1', elements: [{ id: 'e1', type: type as any }] }] }]
}

describe('hydrateCollectionElements', () => {
  it('injects members into collection-view elements', () => {
    const sections = sectionsWith('collection-view')
    hydrateCollectionElements(sections, cards)
    expect(sections[0].columns[0].elements[0].collectionMembers).toEqual(cards)
  })

  it('leaves non-collection elements untouched', () => {
    const sections = sectionsWith('text')
    hydrateCollectionElements(sections, cards)
    expect(sections[0].columns[0].elements[0].collectionMembers).toBeUndefined()
  })
})
