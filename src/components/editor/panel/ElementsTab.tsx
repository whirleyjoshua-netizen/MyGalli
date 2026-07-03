'use client'

import type { CanvasElement, Section } from '@/lib/types/canvas'
import { buildElementList, type ElementListRow } from '@/lib/editor/element-list'
import { SectionRow } from './SectionRow'

interface ElementsTabProps {
  sections: Section[]
  expandedElementId: string | null
  onToggleElement: (row: ElementListRow) => void
  onChangeElement: (sectionId: string, columnId: string, elementId: string, updates: Partial<CanvasElement>) => void
  onDeleteElement: (sectionId: string, columnId: string, elementId: string) => void
  onOpenSectionSettings: (sectionId: string) => void
  onAddElement: (sectionId: string) => void
  isPro: boolean
}

export function ElementsTab(props: ElementsTabProps) {
  const groups = buildElementList(props.sections)

  if (groups.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-sm text-muted-foreground">
        Nothing here yet — add a section on the canvas to start building.
      </div>
    )
  }

  return (
    <div className="p-2">
      {groups.map((group) => (
        <SectionRow
          key={group.sectionId}
          group={group}
          expandedElementId={props.expandedElementId}
          onToggleElement={props.onToggleElement}
          onChangeElement={props.onChangeElement}
          onDeleteElement={props.onDeleteElement}
          onOpenSectionSettings={props.onOpenSectionSettings}
          onAddElement={props.onAddElement}
          isPro={props.isPro}
        />
      ))}
    </div>
  )
}
