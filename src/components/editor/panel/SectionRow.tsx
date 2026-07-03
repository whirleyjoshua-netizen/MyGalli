'use client'

import { Settings2, Plus } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { ElementListGroup, ElementListRow } from '@/lib/editor/element-list'
import { ElementRow } from './ElementRow'

interface SectionRowProps {
  group: ElementListGroup
  expandedElementId: string | null
  onToggleElement: (row: ElementListRow) => void
  onChangeElement: (sectionId: string, columnId: string, elementId: string, updates: Partial<CanvasElement>) => void
  onDeleteElement: (sectionId: string, columnId: string, elementId: string) => void
  onOpenSectionSettings: (sectionId: string) => void
  onAddElement: (sectionId: string) => void
  isPro: boolean
}

export function SectionRow({
  group, expandedElementId, onToggleElement, onChangeElement, onDeleteElement,
  onOpenSectionSettings, onAddElement, isPro,
}: SectionRowProps) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Section {group.index} · {group.layout.replace('-', ' ')}
        </span>
        <button
          onClick={() => onOpenSectionSettings(group.sectionId)}
          aria-label={`Section ${group.index} settings`}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-0.5">
        {group.rows.map((row) => (
          <ElementRow
            key={row.element.id}
            row={row}
            expanded={expandedElementId === row.element.id}
            onToggle={() => onToggleElement(row)}
            onChange={(updates) => onChangeElement(row.sectionId, row.columnId, row.element.id, updates)}
            onDelete={() => onDeleteElement(row.sectionId, row.columnId, row.element.id)}
            isPro={isPro}
          />
        ))}
      </div>
      <button
        onClick={() => onAddElement(group.sectionId)}
        className="mt-1.5 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-primary border border-dashed border-primary/40 rounded-lg hover:bg-primary/5 transition"
      >
        <Plus className="w-3.5 h-3.5" /> Add element
      </button>
    </div>
  )
}
