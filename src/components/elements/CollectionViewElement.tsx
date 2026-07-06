'use client'
import { useEffect, useState, useCallback } from 'react'
import { LayoutGrid, Settings2, Trash2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { CollectionMemberCard } from '@/lib/collections'
import { PublicCollectionView } from './PublicCollectionView'
import { CollectionMembersModal } from './CollectionMembersModal'

interface Props {
  element: CanvasElement
  displayId: string
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onChange: (updates: Partial<CanvasElement>) => void
}

export function CollectionViewElement({ element, displayId, isSelected, onSelect, onDelete, onChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [members, setMembers] = useState<CollectionMemberCard[]>([])

  const loadPreview = useCallback(async () => {
    if (!displayId) return
    const res = await fetch(`/api/collections/${displayId}/members`)
    if (!res.ok) return
    const data = await res.json()
    // Editor preview mirrors the public view: published members, in order.
    setMembers(
      (data.members as { memberId: string; published: boolean; slug: string; title: string; coverImage: string | null; username: string }[])
        .filter((m) => m.published)
        .map((m) => ({ id: m.memberId, username: m.username, slug: m.slug, title: m.title, description: null, coverImage: m.coverImage, category: null }))
    )
  }, [displayId])

  useEffect(() => { loadPreview() }, [loadPreview])

  const cols = element.collectionColumns || 3

  return (
    <div
      onClick={onSelect}
      className={`relative rounded-xl border-2 p-3 transition-colors ${isSelected ? 'border-primary' : 'border-transparent hover:border-border'}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Board gallery</span>
        <button onClick={(e) => { e.stopPropagation(); setModalOpen(true) }} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20">
          <Settings2 className="h-3 w-3" /> Manage pages
        </button>
        <div className="ml-auto flex items-center gap-1">
          {[2, 3, 4].map((c) => (
            <button key={c} onClick={(e) => { e.stopPropagation(); onChange({ collectionColumns: c as 2 | 3 | 4 }) }}
              className={`h-6 w-6 rounded text-xs ${cols === c ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>{c}</button>
          ))}
          <button aria-label="Delete" onClick={(e) => { e.stopPropagation(); onDelete() }} className="ml-1 text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <PublicCollectionView element={{ ...element, collectionMembers: members }} />

      <CollectionMembersModal boardId={displayId} isOpen={modalOpen} onClose={() => setModalOpen(false)} onChanged={loadPreview} />
    </div>
  )
}
