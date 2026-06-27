'use client'

import { useState, useEffect } from 'react'
import type { Tab } from '@/lib/types/tabs'
import type { HeaderCardConfig } from '@/lib/types/header-card'
import type { BackgroundConfig } from '@/lib/types/background'
import { getBackgroundStyles, DEFAULT_BACKGROUND_CONFIG } from '@/lib/types/background'
import { renderElement, getGridClass, getColumnStyles } from '@/lib/render-elements'
import { PublicHeaderCard } from '@/components/header/PublicHeaderCard'

interface PublicTabViewProps {
  tabs: Tab[]
  style?: 'underline' | 'pills' | 'boxed'
  alignment?: 'left' | 'center' | 'stretch'
  displayId?: string
  defaultHeaderCard?: HeaderCardConfig | null
  defaultBackground?: BackgroundConfig
}

export function PublicTabView({
  tabs,
  style = 'underline',
  alignment = 'center',
  displayId,
  defaultHeaderCard,
  defaultBackground = DEFAULT_BACKGROUND_CONFIG,
}: PublicTabViewProps) {
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id)

  // Support URL hash for direct tab linking
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      const tab = tabs.find(t => t.slug === hash)
      if (tab) setActiveTabId(tab.id)
    }
  }, [tabs])

  // Update hash on tab change
  const handleTabSelect = (tabId: string) => {
    setActiveTabId(tabId)
    const tab = tabs.find(t => t.id === tabId)
    if (tab) {
      window.history.replaceState(null, '', `#${tab.slug}`)
    }
  }

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]

  // Resolve per-tab or fallback header/background
  const activeHeaderCard = activeTab?.headerCard ?? defaultHeaderCard
  const activeBackground = activeTab?.background ?? DEFAULT_BACKGROUND_CONFIG
  const backgroundStyles = getBackgroundStyles(activeBackground)

  const alignmentClass =
    alignment === 'left' ? 'justify-start' :
    alignment === 'stretch' ? '' :
    'justify-center'

  const getTabClasses = (isActive: boolean) => {
    switch (style) {
      case 'pills':
        return isActive
          ? 'bg-primary text-primary-foreground rounded-full px-5 py-2'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full px-5 py-2'
      case 'boxed':
        return isActive
          ? 'bg-background border border-border border-b-transparent rounded-t-lg px-5 py-2.5 -mb-px'
          : 'text-muted-foreground hover:text-foreground px-5 py-2.5'
      case 'underline':
      default:
        return isActive
          ? 'border-b-2 border-primary text-foreground px-5 py-3'
          : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent px-5 py-3'
    }
  }

  const containerBorder = style === 'boxed' || style === 'underline' ? 'border-b border-border' : ''

  return (
    <div className="min-h-screen flex flex-col">
      {/* Tab Bar — sticky at top of page */}
      <nav className={`sticky top-0 z-20 bg-background/90 backdrop-blur-sm border-b border-border`}>
        <div className="max-w-6xl mx-auto px-4">
          <div className={`flex items-center gap-1 ${containerBorder} ${alignmentClass}`}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabSelect(tab.id)}
                className={`text-sm font-medium transition-colors whitespace-nowrap ${getTabClasses(tab.id === activeTabId)} ${
                  alignment === 'stretch' ? 'flex-1 text-center' : ''
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Active Tab Page — full independent page with its own background + header + content */}
      {activeTab && (
        <div className="flex-1" style={backgroundStyles}>
          {/* Header Card */}
          {activeHeaderCard?.enabled && (
            <PublicHeaderCard config={activeHeaderCard} />
          )}

          <main className="py-12 px-4">
            <div className="max-w-6xl mx-auto">
              <div className="space-y-8">
                {activeTab.sections.map((section) => (
                  <div
                    key={section.id}
                    className={`grid gap-6 ${getGridClass(section.layout)}`}
                  >
                    {section.columns.map((column) => (
                      <div
                        key={column.id}
                        className="space-y-4"
                        style={getColumnStyles(column)}
                      >
                        {column.elements.map((element) => (
                          <div key={element.id}>
                            {renderElement(element, displayId)}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}

                {activeTab.sections.length === 0 && (
                  <div className="text-center py-12 opacity-50">
                    <p>This tab is empty</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <footer className="mt-16 pt-8 border-t border-current/10 text-center">
                <p className="text-sm opacity-50">
                  Made with{' '}
                  <a href="/" className="underline hover:opacity-80">
                    Galli
                  </a>
                </p>
              </footer>
            </div>
          </main>
        </div>
      )}
    </div>
  )
}
