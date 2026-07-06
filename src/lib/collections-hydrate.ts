import type { Section } from '@/lib/types/canvas'
import type { CollectionMemberCard } from '@/lib/collections'

// Mutates parsed sections in place, attaching the resolved member cards to every
// collection-view element so the shared renderElement() can draw the gallery.
export function hydrateCollectionElements(sections: Section[], members: CollectionMemberCard[]): void {
  for (const section of sections) {
    for (const column of section.columns) {
      for (const element of column.elements) {
        if (element.type === 'collection-view') {
          element.collectionMembers = members
        }
      }
    }
  }
}
