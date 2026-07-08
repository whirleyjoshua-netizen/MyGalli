'use client'

import { X, Plus, Trash2, GripVertical } from 'lucide-react'
import type { TabsConfig, Tab } from '@/lib/types/tabs'
import { createTab } from '@/lib/types/tabs'
import type { Section } from '@/lib/types/canvas'

interface TabEditorProps {
  isOpen: boolean
  onClose: () => void
  config: TabsConfig
  onChange: (config: TabsConfig) => void
  currentSections: Section[]  // For migrating existing content when enabling tabs
}

export function TabEditorBody({
  config,
  onChange,
  currentSections,
}: {
  config: TabsConfig
  onChange: (config: TabsConfig) => void
  currentSections: Section[]
}) {
  const enableTabs = () => {
    const firstTab = createTab('Main')
    firstTab.sections = currentSections.length > 0 ? [...currentSections] : firstTab.sections
    onChange({
      ...config,
      enabled: true,
      tabs: [firstTab],
    })
  }

  const disableTabs = () => {
    onChange({
      ...config,
      enabled: false,
      tabs: [],
    })
  }

  const addTab = () => {
    const newTab = createTab(`Tab ${config.tabs.length + 1}`)
    onChange({
      ...config,
      tabs: [...config.tabs, newTab],
    })
  }

  const renameTab = (tabId: string, newLabel: string) => {
    onChange({
      ...config,
      tabs: config.tabs.map(t =>
        t.id === tabId
          ? { ...t, label: newLabel, slug: newLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
          : t
      ),
    })
  }

  const deleteTab = (tabId: string) => {
    const remaining = config.tabs.filter(t => t.id !== tabId)
    if (remaining.length === 0) {
      disableTabs()
    } else {
      onChange({ ...config, tabs: remaining })
    }
  }

  const moveTab = (tabId: string, direction: 'up' | 'down') => {
    const idx = config.tabs.findIndex(t => t.id === tabId)
    if (idx < 0) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= config.tabs.length) return
    const newTabs = [...config.tabs]
    ;[newTabs[idx], newTabs[newIdx]] = [newTabs[newIdx], newTabs[idx]]
    onChange({ ...config, tabs: newTabs })
  }

  return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Enable Tabs</div>
              <div className="text-sm text-muted-foreground">
                {config.enabled
                  ? 'Each tab has its own canvas with sections and elements'
                  : 'Organize your page content into tabs'
                }
              </div>
            </div>
            <button
              onClick={() => config.enabled ? disableTabs() : enableTabs()}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                config.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  config.enabled ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          {config.enabled && (
            <>
              {/* Tab List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Tabs</label>
                  <button
                    onClick={addTab}
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Add Tab
                  </button>
                </div>
                <div className="space-y-2">
                  {config.tabs.map((tab, index) => (
                    <div
                      key={tab.id}
                      className="flex items-center gap-2 p-2 rounded-lg border border-border"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <input
                        type="text"
                        value={tab.label}
                        onChange={(e) => renameTab(tab.id, e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1 border border-border rounded text-sm bg-background"
                      />
                      <span className="text-xs text-muted-foreground">
                        {tab.sections.reduce((count, s) =>
                          count + s.columns.reduce((c, col) => c + col.elements.length, 0), 0
                        )} elements
                      </span>
                      {index > 0 && (
                        <button
                          onClick={() => moveTab(tab.id, 'up')}
                          className="p-1 hover:bg-muted rounded text-muted-foreground"
                          title="Move up"
                        >
                          <span className="text-xs">^</span>
                        </button>
                      )}
                      {index < config.tabs.length - 1 && (
                        <button
                          onClick={() => moveTab(tab.id, 'down')}
                          className="p-1 hover:bg-muted rounded text-muted-foreground"
                          title="Move down"
                        >
                          <span className="text-xs">v</span>
                        </button>
                      )}
                      {config.tabs.length > 1 && (
                        <button
                          onClick={() => deleteTab(tab.id)}
                          className="p-1 hover:bg-destructive/10 rounded text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tab Style */}
              <div>
                <label className="block text-sm font-medium mb-2">Tab Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['underline', 'pills', 'boxed'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => onChange({ ...config, style: s })}
                      className={`px-3 py-2 rounded-lg border text-sm capitalize ${
                        (config.style || 'underline') === s
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:border-primary/50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Alignment */}
              <div>
                <label className="block text-sm font-medium mb-2">Tab Alignment</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['left', 'center', 'stretch'] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => onChange({ ...config, alignment: a })}
                      className={`px-3 py-2 rounded-lg border text-sm capitalize ${
                        (config.alignment || 'center') === a
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:border-primary/50'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
  )
}

export function TabEditor({ isOpen, onClose, config, onChange, currentSections }: TabEditorProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">Tab Navigation</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <TabEditorBody config={config} onChange={onChange} currentSections={currentSections} />

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
