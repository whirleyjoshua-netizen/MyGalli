// Validate and sanitize AI-generated page structure

import type { Section, CanvasElement, ElementType } from '@/lib/types/canvas'
import type { BackgroundConfig } from '@/lib/types/background'
import type { HeaderCardConfig } from '@/lib/types/header-card'
import type { TabsConfig } from '@/lib/types/tabs'

const VALID_ELEMENT_TYPES: ElementType[] = [
  'text', 'heading', 'image', 'embed', 'button', 'list', 'quote',
  'kpi', 'table', 'callout', 'toggle',
  'mcq', 'rating', 'shortanswer', 'chart', 'code', 'slideshow',
  'comment', 'poll', 'card',
  'tracker', 'kit-profile', 'game-schedule', 'workout-schedule', 'meal-prep', 'jersey',
  'experience-entry', 'education-entry', 'skill-bar', 'certification-badge',
  'wedding-timeline', 'wedding-party', 'wedding-rsvp', 'wedding-stats',
  'wedding-registry', 'wedding-hashtags',
  'mood-board', 'color-palette', 'playlist', 'quote-wall',
  'social-stats', 'collab-card', 'rate-card', 'media-kit-stats',
  'course-list', 'gpa-card', 'test-scores', 'awards-showcase',
  'business-menu', 'business-hours', 'business-review', 'business-promo',
  'timeline',
]

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export interface GeneratedPage {
  title: string
  description?: string
  sections: Section[]
  tabs: TabsConfig | null
  headerCard: HeaderCardConfig | null
  background: BackgroundConfig | null
}

/**
 * Extract JSON from Claude's response — handles raw JSON or code-fenced JSON
 */
export function extractJSON(raw: string): string {
  // Try stripping markdown code fences
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()

  // Find first { to last }
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1)
  }

  return raw.trim()
}

/**
 * Validate and fix IDs on a generated page structure.
 * Returns a clean, safe page object or throws on invalid structure.
 */
export function validateGeneratedPage(raw: unknown): GeneratedPage {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Response is not an object')
  }

  const data = raw as Record<string, unknown>

  // Title
  const title = typeof data.title === 'string' && data.title.trim()
    ? data.title.trim().slice(0, 100)
    : 'Untitled Page'

  const description = typeof data.description === 'string'
    ? data.description.slice(0, 300)
    : undefined

  // Sections
  const sections = validateSections(
    Array.isArray(data.sections) ? data.sections : []
  )

  // Tabs
  let tabs: TabsConfig | null = null
  if (data.tabs && typeof data.tabs === 'object' && (data.tabs as any).enabled) {
    const rawTabs = data.tabs as any
    if (Array.isArray(rawTabs.tabs) && rawTabs.tabs.length > 0) {
      tabs = {
        enabled: true,
        tabs: rawTabs.tabs.map((tab: any) => ({
          id: `tab-${uid()}`,
          label: String(tab.label || 'Tab'),
          slug: String(tab.slug || tab.label || 'tab').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          sections: validateSections(Array.isArray(tab.sections) ? tab.sections : []),
          ...(tab.headerCard ? { headerCard: validateHeaderCard(tab.headerCard) } : {}),
          ...(tab.background ? { background: validateBackground(tab.background) } : {}),
        })),
        style: ['underline', 'pills', 'boxed'].includes(rawTabs.style) ? rawTabs.style : 'underline',
        alignment: ['left', 'center', 'stretch'].includes(rawTabs.alignment) ? rawTabs.alignment : 'center',
      }
    }
  }

  // Header card
  const headerCard = data.headerCard ? validateHeaderCard(data.headerCard) : null

  // Background
  const background = data.background ? validateBackground(data.background) : null

  // If tabs are used, sections should be empty (tabs hold their own sections)
  const finalSections = tabs ? [] : sections

  // Ensure we have SOME content
  if (!tabs && finalSections.length === 0) {
    throw new Error('Generated page has no content')
  }

  if (tabs && tabs.tabs.every(t => t.sections.length === 0)) {
    throw new Error('Generated page tabs have no content')
  }

  return { title, description, sections: finalSections, tabs, headerCard, background }
}

function validateSections(raw: any[]): Section[] {
  return raw.map((sec, i) => {
    const layout = ['full-width', 'two-column', 'three-column'].includes(sec?.layout)
      ? sec.layout
      : 'full-width'

    const expectedCols = layout === 'full-width' ? 1 : layout === 'two-column' ? 2 : 3
    const rawCols = Array.isArray(sec?.columns) ? sec.columns : []

    // Pad or trim columns to match layout
    const columns = []
    for (let c = 0; c < expectedCols; c++) {
      const rawCol = rawCols[c] || { elements: [] }
      const elements = Array.isArray(rawCol.elements)
        ? rawCol.elements.map(validateElement).filter(Boolean) as CanvasElement[]
        : []
      columns.push({
        id: `col-${uid()}-${c}`,
        elements,
      })
    }

    return {
      id: `sec-${uid()}-${i}`,
      layout,
      columns,
    }
  }).filter(sec => sec.columns.some(col => col.elements.length > 0))
}

function validateElement(raw: any): CanvasElement | null {
  if (!raw || typeof raw !== 'object') return null
  if (!raw.type || !VALID_ELEMENT_TYPES.includes(raw.type)) return null

  // Rebuild element with fresh ID, keeping all recognized fields
  const el: CanvasElement = {
    ...raw,
    id: `el-${uid()}`,
    type: raw.type,
  }

  return el
}

function validateHeaderCard(raw: any): HeaderCardConfig | null {
  if (!raw || typeof raw !== 'object') return null

  return {
    enabled: true,
    template: ['profile', 'resume', 'catalog'].includes(raw.template) ? raw.template : 'profile',
    photoPosition: ['left-offset', 'center-overlap', 'right-inline', 'hidden'].includes(raw.photoPosition)
      ? raw.photoPosition : 'hidden',
    name: String(raw.name || ''),
    title: raw.title ? String(raw.title) : undefined,
    subtitle: raw.subtitle ? String(raw.subtitle) : undefined,
    bio: raw.bio ? String(raw.bio) : undefined,
    textAlignment: raw.textAlignment === 'left' ? 'left' : 'center',
    actions: Array.isArray(raw.actions)
      ? raw.actions.slice(0, 4).map((a: any) => ({
          id: `action-${uid()}`,
          label: String(a.label || 'Button'),
          url: String(a.url || '#'),
          icon: ['download', 'mail', 'link', 'phone', 'github', 'linkedin'].includes(a.icon) ? a.icon : undefined,
          variant: ['solid', 'outline', 'ghost'].includes(a.variant) ? a.variant : 'solid',
          color: ['blue', 'green', 'purple', 'orange', 'slate'].includes(a.color) ? a.color : 'green',
        }))
      : [],
    overlayOpacity: 0,
  }
}

function validateBackground(raw: any): BackgroundConfig | null {
  if (!raw || typeof raw !== 'object') return null

  const type = ['solid', 'gradient', 'pattern'].includes(raw.type) ? raw.type : 'solid'

  const base: BackgroundConfig = {
    type,
    scrollBehavior: raw.scrollBehavior === 'fixed' ? 'fixed' : 'scroll',
    opacity: typeof raw.opacity === 'number' ? Math.min(100, Math.max(0, raw.opacity)) : 100,
  }

  if (type === 'solid') {
    base.solidColor = typeof raw.solidColor === 'string' ? raw.solidColor : '#ffffff'
  }

  if (type === 'gradient' && raw.gradient) {
    base.gradient = {
      type: raw.gradient.type === 'radial' ? 'radial' : 'linear',
      direction: String(raw.gradient.direction || '135deg'),
      colors: Array.isArray(raw.gradient.colors) ? raw.gradient.colors.map(String) : ['#667eea', '#764ba2'],
    }
  }

  return base
}
