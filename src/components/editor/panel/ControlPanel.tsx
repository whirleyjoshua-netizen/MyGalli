'use client'

import { PanelRightClose, PanelRightOpen, Layers, SlidersHorizontal } from 'lucide-react'

interface ControlPanelProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  activeTab: 'elements' | 'page'
  onTabChange: (tab: 'elements' | 'page') => void
  elementsSlot: React.ReactNode
  pageSlot: React.ReactNode
}

export function ControlPanel({
  collapsed,
  onToggleCollapsed,
  activeTab,
  onTabChange,
  elementsSlot,
  pageSlot,
}: ControlPanelProps) {
  if (collapsed) {
    return (
      <div className="w-12 flex-shrink-0 border-l border-border bg-background flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggleCollapsed}
          aria-label="Expand panel"
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>
        <button onClick={() => { onTabChange('elements'); onToggleCollapsed() }} aria-label="Elements" className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition">
          <Layers className="w-4 h-4" />
        </button>
        <button onClick={() => { onTabChange('page'); onToggleCollapsed() }} aria-label="Page settings" className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition">
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-80 flex-shrink-0 border-l border-border bg-background flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border flex-shrink-0">
        <div className="flex-1 flex gap-1 bg-muted/60 rounded-lg p-1">
          <button
            onClick={() => onTabChange('elements')}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-1.5 rounded-md transition ${activeTab === 'elements' ? 'bg-background text-primary font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Layers className="w-4 h-4" /> Elements
          </button>
          <button
            onClick={() => onTabChange('page')}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-1.5 rounded-md transition ${activeTab === 'page' ? 'bg-background text-primary font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <SlidersHorizontal className="w-4 h-4" /> Page
          </button>
        </div>
        <button
          onClick={onToggleCollapsed}
          aria-label="Collapse panel"
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
        {activeTab === 'elements' ? elementsSlot : pageSlot}
      </div>
    </div>
  )
}
