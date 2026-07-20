// Extracted from route.ts: a Next.js App Router route file may only export
// route handlers and a small set of known config keys. Any other export fails
// the build's generated type check ("not assignable to type 'never'").
import type { Section } from '@/lib/types/canvas'
import type { TabsConfig } from '@/lib/types/tabs'

// Collects every Section a display can hold: the top-level `sections` column
// plus each tab's own `sections` array (Display.tabs is a separate Json
// column — see src/lib/types/tabs.ts). Defensive against null/malformed JSON
// on older rows (including JSON-string-encoded columns) so a bad `sections`
// or `tabs` value never throws. Tab sections are only contributed when tabs
// are enabled — disabled tabs are never rendered on the public page, so
// their sections must not appear in Section Engagement.
export function collectAllSections(sections: unknown, tabs: unknown): Section[] {
  let sectionsValue: unknown = sections
  if (typeof sectionsValue === 'string') {
    try {
      sectionsValue = JSON.parse(sectionsValue)
    } catch {
      sectionsValue = []
    }
  }
  const topLevel = Array.isArray(sectionsValue) ? (sectionsValue as unknown as Section[]) : []

  let tabsValue: unknown = tabs
  if (typeof tabsValue === 'string') {
    try {
      tabsValue = JSON.parse(tabsValue)
    } catch {
      tabsValue = null
    }
  }

  let tabSections: Section[] = []
  try {
    const config = tabsValue as TabsConfig | null | undefined
    if (config && typeof config === 'object' && config.enabled === true && Array.isArray(config.tabs)) {
      tabSections = config.tabs.flatMap((tab) => (Array.isArray(tab?.sections) ? tab.sections : []))
    }
  } catch {
    tabSections = []
  }

  return [...topLevel, ...tabSections]
}
