'use client'

import { useState, useEffect, useRef } from 'react'
import { ImageIcon, AlignVerticalSpaceAround } from 'lucide-react'
import { ColumnCanvas } from '@/components/canvas/ColumnCanvas'
import { SlashCommandMenu } from '@/components/canvas/SlashCommandMenu'
import { BackgroundSettings } from '@/components/canvas/BackgroundSettings'
import { ColumnStyleSettings } from '@/components/canvas/ColumnStyleSettings'
import { SpacingSettings } from '@/components/canvas/SpacingSettings'
import type { Section, LayoutMode, ElementType, CanvasElement, ColumnSettings } from '@/lib/types/canvas'
import { createElement, DEFAULT_COLUMN_SETTINGS } from '@/lib/types/canvas'
import type { BackgroundConfig } from '@/lib/types/background'
import { DEFAULT_BACKGROUND_CONFIG } from '@/lib/types/background'
import type { SpacingConfig } from '@/lib/types/spacing'
import { DEFAULT_SPACING_CONFIG } from '@/lib/types/spacing'

export function ProfileCanvasEditor({
  displayId,
  initialSections,
  initialBackground,
  initialSpacing,
  initialVersion,
  onSavingChange,
}: {
  displayId: string
  initialSections: Section[]
  initialBackground: BackgroundConfig | null
  initialSpacing: SpacingConfig | null
  initialVersion: number
  onSavingChange: (saving: boolean) => void
}) {
  const [sections, setSections] = useState<Section[]>(
    initialSections.length ? initialSections : [{ id: `section-${Date.now()}`, layout: 'full-width', columns: [{ id: `col-${Date.now()}`, elements: [] }] }],
  )
  const [background, setBackground] = useState<BackgroundConfig>(initialBackground || DEFAULT_BACKGROUND_CONFIG)
  const [spacing, setSpacing] = useState<SpacingConfig>(initialSpacing || DEFAULT_SPACING_CONFIG)
  const versionRef = useRef(initialVersion)
  const [conflict, setConflict] = useState(false)

  // Slash menu
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashPos, setSlashPos] = useState({ x: 0, y: 0 })
  const [curSection, setCurSection] = useState<string | null>(null)
  const [curColumn, setCurColumn] = useState<string | null>(null)

  // Settings modals
  const [showBackground, setShowBackground] = useState(false)
  const [showSpacing, setShowSpacing] = useState(false)
  const [showColumn, setShowColumn] = useState(false)
  const [colSection, setColSection] = useState<string | null>(null)
  const [colId, setColId] = useState<string | null>(null)

  // Debounced autosave (content fields → version-checked PATCH)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (conflict) return
    const t = setTimeout(async () => {
      onSavingChange(true)
      try {
        const res = await fetch(`/api/displays/${displayId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sections, background, spacing, version: versionRef.current }),
        })
        if (res.status === 409) {
          setConflict(true)
          return
        }
        if (res.ok) {
          const updated = await res.json()
          if (typeof updated.version === 'number') versionRef.current = updated.version
        }
      } finally {
        onSavingChange(false)
      }
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, background, spacing])

  // Section ops
  const addSection = (layout: LayoutMode) => {
    const count = layout === 'full-width' ? 1 : layout === 'two-column' ? 2 : 3
    const columns = Array.from({ length: count }, (_, i) => ({ id: `col-${Date.now()}-${i}`, elements: [] }))
    setSections((prev) => [...prev, { id: `section-${Date.now()}`, layout, columns }])
  }
  const deleteSection = (sectionId: string) => setSections((prev) => prev.filter((s) => s.id !== sectionId))

  // Slash menu
  const openSlashMenu = (sectionId: string, columnId: string, position?: { x: number; y: number }) => {
    setCurSection(sectionId)
    setCurColumn(columnId)
    setSlashPos(position || { x: window.innerWidth / 2 - 160, y: 200 })
    setShowSlashMenu(true)
  }
  const handleCommandSelect = (type: ElementType) => {
    if (!curSection || !curColumn) return
    const newElement = createElement(type)
    setSections((prev) =>
      prev.map((section) =>
        section.id === curSection
          ? { ...section, columns: section.columns.map((col) => (col.id === curColumn ? { ...col, elements: [...col.elements, newElement] } : col)) }
          : section,
      ),
    )
    setShowSlashMenu(false)
    setCurSection(null)
    setCurColumn(null)
  }

  // Element ops
  const updateElement = (sectionId: string, columnId: string, elementId: string, updates: Partial<CanvasElement>) =>
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, columns: section.columns.map((col) => (col.id === columnId ? { ...col, elements: col.elements.map((el) => (el.id === elementId ? { ...el, ...updates } : el)) } : col)) }
          : section,
      ),
    )
  const deleteElement = (sectionId: string, columnId: string, elementId: string) =>
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, columns: section.columns.map((col) => (col.id === columnId ? { ...col, elements: col.elements.filter((el) => el.id !== elementId) } : col)) }
          : section,
      ),
    )

  // Column settings
  const openColumnSettings = (sectionId: string, columnId: string) => {
    setColSection(sectionId)
    setColId(columnId)
    setShowColumn(true)
  }
  const currentColumnSettings = (): ColumnSettings => {
    const s = sections.find((x) => x.id === colSection)
    return s?.columns.find((c) => c.id === colId)?.settings || DEFAULT_COLUMN_SETTINGS
  }
  const updateColumnSettings = (settings: ColumnSettings) => {
    if (!colSection || !colId) return
    setSections((prev) =>
      prev.map((section) =>
        section.id === colSection
          ? { ...section, columns: section.columns.map((col) => (col.id === colId ? { ...col, settings } : col)) }
          : section,
      ),
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      {conflict && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2.5 text-sm flex items-center justify-between">
          <span>This profile was updated elsewhere. Reload to get the latest — unsaved changes will be lost.</span>
          <button onClick={() => window.location.reload()} className="ml-4 px-3 py-1 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition cursor-pointer">
            Reload
          </button>
        </div>
      )}

      {/* Canvas toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <span className="text-sm font-bold mr-auto">Your canvas</span>
        <button onClick={() => setShowBackground(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition">
          <ImageIcon className="w-4 h-4" /> Background
        </button>
        <button onClick={() => setShowSpacing(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition">
          <AlignVerticalSpaceAround className="w-4 h-4" /> Spacing
        </button>
      </div>

      <ColumnCanvas
        sections={sections}
        onSectionsChange={setSections}
        onAddSection={addSection}
        onDeleteSection={deleteSection}
        onOpenSlashMenu={openSlashMenu}
        onUpdateElement={updateElement}
        onDeleteElement={deleteElement}
        onOpenColumnSettings={openColumnSettings}
        displayId={displayId}
        spacing={spacing}
      />

      {showSlashMenu && (
        <SlashCommandMenu position={slashPos} onSelect={handleCommandSelect} onClose={() => setShowSlashMenu(false)} isKitPage={false} hideApps />
      )}
      <BackgroundSettings isOpen={showBackground} onClose={() => setShowBackground(false)} config={background} onChange={setBackground} />
      <SpacingSettings isOpen={showSpacing} onClose={() => setShowSpacing(false)} config={spacing} onChange={setSpacing} />
      <ColumnStyleSettings isOpen={showColumn} onClose={() => setShowColumn(false)} settings={currentColumnSettings()} onChange={updateColumnSettings} />
    </div>
  )
}
