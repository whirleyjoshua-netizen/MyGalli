// src/lib/appointments-server.ts
import { db } from '@/lib/db'
import type { AppointmentConfig } from '@/lib/appointments'

// Deep-walk a Display's section JSON to find an appointments element by id.
// Mirrors the traversal in src/lib/live-feed-reconcile.ts (findLiveFeedIds):
// sections[].columns[].elements[].
export function findApptElement(sections: unknown, elementId: string): any | null {
  if (!Array.isArray(sections)) return null
  for (const section of sections as any[]) {
    for (const col of section?.columns ?? []) {
      for (const el of col?.elements ?? []) {
        if (el?.id === elementId && el?.type === 'appointments') return el
      }
    }
  }
  return null
}

export function elementToConfig(el: any): AppointmentConfig {
  return {
    duration: el.apptDuration ?? 30,
    timezone: el.apptTimezone || 'UTC',
    weeklyRules: Array.isArray(el.apptWeeklyRules) ? el.apptWeeklyRules : [],
    buffer: el.apptBuffer ?? 0,
    leadTimeHours: el.apptLeadTimeHours ?? 12,
    maxDaysAhead: el.apptMaxDaysAhead ?? 30,
  }
}

// Load a display + its appointments element, searching main sections and
// every tab's own sections (tabs each carry an independent Section[]).
export async function loadApptContext(displayId: string, elementId: string) {
  const display = await db.display.findUnique({
    where: { id: displayId },
    select: {
      id: true,
      userId: true,
      published: true,
      sections: true,
      tabs: true,
      user: { select: { plan: true } },
    },
  })
  if (!display) return null

  let el = findApptElement(display.sections as any, elementId)
  if (!el && Array.isArray(display.tabs)) {
    for (const tab of display.tabs as any[]) {
      el = findApptElement(tab?.sections, elementId)
      if (el) break
    }
  }
  return el ? { display, el } : null
}
