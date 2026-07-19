import type { Section, CanvasElement } from '@/lib/types/canvas'

export interface InteractionRecord {
  elementId: string
  elementType: string
  at: string
}

export interface SectionEngagementRow {
  id: string
  label: string
  count: number
}

export interface WidgetPerformanceRow {
  elementType: string
  label: string
  stat: string
  count: number
  trend: number[]
}

export interface RawActivity {
  kind: 'view' | 'interact' | 'share' | 'follow'
  elementType?: string
  action?: string
  country?: string | null
  at: string
}

export interface LiveActivityItem {
  id: string
  label: string
  country: string | null
  at: string
}

const MAX_LABEL_LENGTH = 40

function humanise(elementType: string): string {
  return elementType
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function elementsOf(section: Section): CanvasElement[] {
  return section.columns.flatMap((column) => column.elements)
}

// `Section` has no name field, so a label is derived: first heading's text,
// else the dominant element type, else a positional fallback.
export function deriveSectionLabel(section: Section, index: number): string {
  let elements = elementsOf(section)

  const heading = elements.find(
    (el) => el.type === 'heading' && typeof el.content === 'string' && el.content.trim().length > 0
  )
  if (heading) {
    const text = heading.content!.trim()
    return text.length > MAX_LABEL_LENGTH ? `${text.slice(0, MAX_LABEL_LENGTH - 1)}…` : text
  }

  // Filter out empty headings before counting dominant type
  elements = elements.filter(
    (el) => !(el.type === 'heading' && (!el.content || typeof el.content !== 'string' || el.content.trim().length === 0))
  )

  if (elements.length > 0) {
    const counts = new Map<string, number>()
    for (const el of elements) counts.set(el.type, (counts.get(el.type) || 0) + 1)
    let dominant: string = elements[0].type
    let best = 0
    for (const [type, count] of counts) {
      if (count > best) {
        best = count
        dominant = type
      }
    }
    return humanise(dominant)
  }

  return `Section ${index + 1}`
}

export function sectionEngagement(
  sections: Section[],
  interactions: InteractionRecord[]
): SectionEngagementRow[] {
  const sectionByElement = new Map<string, string>()
  for (const section of sections) {
    for (const el of elementsOf(section)) sectionByElement.set(el.id, section.id)
  }

  const counts = new Map<string, number>()
  for (const section of sections) counts.set(section.id, 0)
  for (const interaction of interactions) {
    const sectionId = sectionByElement.get(interaction.elementId)
    if (!sectionId) continue
    counts.set(sectionId, (counts.get(sectionId) || 0) + 1)
  }

  return sections
    .map((section, index) => ({
      id: section.id,
      label: deriveSectionLabel(section, index),
      count: counts.get(section.id) || 0,
    }))
    .sort((a, b) => b.count - a.count)
}

// Explicit per-type primary stat. Unmapped types fall back to interactions.
type StatFormatter = (count: number, viewCount: number) => string

const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`

const WIDGET_PRIMARY_STAT: Record<string, StatFormatter> = {
  poll: (count, views) => `${views > 0 ? Math.round((count / views) * 100) : 0}% of viewers voted`,
  // No 'rating' entry: it would format identically to the generic fallback
  // below (plural 'interaction'/'interactions'), so it's omitted rather than
  // duplicated.
  form: (count) => plural(count, 'submission', 'submissions'),
  // Currently unreachable: no element emits `elementType: 'video'` interaction
  // events. Left in place for when a video element is added.
  video: (count) => plural(count, 'play', 'plays'),
  // Counts uploaded-file playback only (native <audio> onPlay). Spotify/SoundCloud
  // iframe embeds expose no play event and are never counted here.
  'audio-player': (count) => plural(count, 'play', 'plays'),
  // Currently unreachable: PublicCalendarElement has no save/export/add-to-calendar
  // action, so no interaction event can ever populate this count. Left in place
  // for when a save feature is added.
  calendar: (count) => plural(count, 'save', 'saves'),
  'link-hub': (count) => plural(count, 'click', 'clicks'),
  // Fires on click-through to the external payment destination, not on a
  // confirmed tip — we cannot observe whether the visitor actually paid.
  'tip-jar': (count) => plural(count, 'tip link click', 'tip link clicks'),
}

export function widgetPerformance(
  interactions: InteractionRecord[],
  viewCount: number
): WidgetPerformanceRow[] {
  const byType = new Map<string, InteractionRecord[]>()
  for (const interaction of interactions) {
    const bucket = byType.get(interaction.elementType) || []
    bucket.push(interaction)
    byType.set(interaction.elementType, bucket)
  }

  return Array.from(byType.entries())
    .map(([elementType, records]) => {
      const perDay = new Map<string, number>()
      for (const record of records) {
        const day = record.at.slice(0, 10)
        perDay.set(day, (perDay.get(day) || 0) + 1)
      }
      const trend = Array.from(perDay.keys())
        .sort()
        .map((day) => perDay.get(day)!)

      const format = WIDGET_PRIMARY_STAT[elementType] ?? ((count: number) => plural(count, 'interaction', 'interactions'))

      return {
        elementType,
        label: humanise(elementType),
        stat: format(records.length, viewCount),
        count: records.length,
        trend,
      }
    })
    .sort((a, b) => b.count - a.count)
}

// Country codes we bother naming. Anything else renders as the raw code rather
// than pretending we know it.
const COUNTRY_NAMES: Record<string, string> = {
  US: 'the United States', GB: 'the United Kingdom', DE: 'Germany', FR: 'France',
  CA: 'Canada', AU: 'Australia', JP: 'Japan', BR: 'Brazil', IN: 'India',
  NL: 'the Netherlands', ES: 'Spain', IT: 'Italy', SE: 'Sweden', MX: 'Mexico',
  KR: 'South Korea', IE: 'Ireland', NZ: 'New Zealand', ZA: 'South Africa',
}

function countryPhrase(country: string | null | undefined): string {
  if (!country) return 'Someone'
  return `Someone from ${COUNTRY_NAMES[country] ?? country}`
}

export function liveActivityItems(raw: RawActivity[]): LiveActivityItem[] {
  return raw.map((event, index) => {
    const who = countryPhrase(event.country)
    let label: string

    switch (event.kind) {
      case 'view':
        label = `${who} opened your page`
        break
      case 'share':
        label = `${who} shared your page`
        break
      case 'follow':
        label = `${who} followed you`
        break
      default: {
        const type = event.elementType ? humanise(event.elementType).toLowerCase() : 'element'
        const verb = event.action === 'vote' ? 'voted in' : 'interacted with'
        label = `${who} ${verb} your ${type}`
      }
    }

    return { id: `${event.at}_${event.kind}_${index}`, label, country: event.country ?? null, at: event.at }
  })
}
