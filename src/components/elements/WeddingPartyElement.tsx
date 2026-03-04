'use client'

import { Trash2, Plus, X, Users } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface PartyMember {
  name: string
  role: string
  group: 'bride' | 'groom' | 'shared'
  photo?: string
}

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function WeddingPartyElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const title = element.weddingPartyTitle || 'Wedding Party'
  const members: PartyMember[] = element.weddingPartyMembers || []

  const updateMember = (index: number, field: keyof PartyMember, value: string) => {
    const updated = members.map((m, i) =>
      i === index ? { ...m, [field]: value } : m
    )
    onChange({ weddingPartyMembers: updated })
  }

  const addMember = () => {
    onChange({
      weddingPartyMembers: [
        ...members,
        { name: '', role: '', group: 'shared' as const },
      ],
    })
  }

  const removeMember = (index: number) => {
    onChange({ weddingPartyMembers: members.filter((_, i) => i !== index) })
  }

  return (
    <div
      className={`relative rounded-xl border transition-all ${
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-border/80'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      {/* Controls */}
      {isSelected && (
        <div className="absolute -top-3 right-2 flex items-center gap-1 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg bg-background border border-border shadow-sm hover:bg-destructive/10 hover:text-destructive transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5" style={{ color: '#E8B4B8' }} />
          <input
            type="text"
            value={title}
            onChange={(e) => onChange({ weddingPartyTitle: e.target.value })}
            className="text-lg font-semibold bg-transparent border-none outline-none flex-1 placeholder:text-muted-foreground/50"
            placeholder="Wedding Party"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Members */}
        <div className="space-y-3">
          {members.map((member, index) => (
            <div
              key={index}
              className="relative rounded-lg border border-border/60 bg-muted/20 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Remove button */}
              <button
                onClick={() => removeMember(index)}
                className="absolute top-2 right-2 p-1 rounded-md hover:bg-destructive/10 hover:text-destructive transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="grid grid-cols-2 gap-3 pr-6">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) => updateMember(index, 'name', e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="Full name"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Role</label>
                  <input
                    type="text"
                    value={member.role}
                    onChange={(e) => updateMember(index, 'role', e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="e.g. Best Man"
                  />
                </div>

                {/* Group */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Group</label>
                  <select
                    value={member.group}
                    onChange={(e) => updateMember(index, 'group', e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    <option value="bride">Bride&apos;s Side</option>
                    <option value="groom">Groom&apos;s Side</option>
                    <option value="shared">Shared</option>
                  </select>
                </div>

                {/* Photo URL */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Photo URL (optional)</label>
                  <input
                    type="text"
                    value={member.photo || ''}
                    onChange={(e) => updateMember(index, 'photo', e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Preview badge */}
              <div className="mt-2 flex items-center gap-2">
                {member.photo && (
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2" style={{ borderColor: '#E8B4B8' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <span className="text-xs text-muted-foreground">
                  {member.name || 'Unnamed'} — {member.role || 'No role'} ({
                    member.group === 'bride' ? "Bride's Side" :
                    member.group === 'groom' ? "Groom's Side" :
                    'Shared'
                  })
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Add member button */}
        <button
          onClick={(e) => { e.stopPropagation(); addMember() }}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition"
          style={{ backgroundColor: '#E8B4B8', color: '#fff' }}
        >
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>
    </div>
  )
}
