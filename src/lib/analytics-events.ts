// The complete set of analytics event types Galli records. The track route
// rejects anything outside this list so the events table cannot be polluted
// by arbitrary client-supplied strings.
export const ANALYTICS_EVENT_TYPES = ['view', 'interact', 'share'] as const

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number]

export function isAnalyticsEventType(value: unknown): value is AnalyticsEventType {
  return typeof value === 'string' && (ANALYTICS_EVENT_TYPES as readonly string[]).includes(value)
}

// Metadata carried by every 'interact' event. Kept generic on purpose: new
// element types need no schema or query changes.
export interface InteractMetadata {
  elementId: string
  elementType: string
  action: string
}

const MAX_METADATA_FIELD_LENGTH = 64

function trimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_METADATA_FIELD_LENGTH) return null
  return trimmed
}

export function parseInteractMetadata(raw: unknown): InteractMetadata | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const elementId = trimmedString(source.elementId)
  const elementType = trimmedString(source.elementType)
  const action = trimmedString(source.action)
  if (!elementId || !elementType || !action) return null
  return { elementId, elementType, action }
}

// Share events carry an optional free-text channel (e.g. 'twitter', 'copy-link').
// Same length cap as interact metadata fields, for the same reason: the track
// route is public and unauthenticated, so nothing bounds what a caller sends.
export function parseShareChannel(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  return trimmedString((raw as Record<string, unknown>).channel)
}
