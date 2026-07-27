// A tiny in-process cache for AI filter suggestions.
//
// Why this exists: the filter-suggest route calls Anthropic (a paid model) to
// turn a plain-English request into a structured filter. Without a durable
// rate store (Upstash/KV) configured, the per-user limiter degrades to a
// per-lambda in-memory Map, so a double-submit or a buggy client retry loop
// could pay for the SAME question several times over. Caching the validated
// result by (workspace schema + normalised question) means an identical
// repeat never re-hits the model.
//
// What it deliberately does NOT do: it is not a security or spend *ceiling*
// (that needs KV or a DB counter). It only removes duplicate spend. And it
// stores ONLY the derived filter structure + human summary — never any record
// data — so it cannot leak rows even if an entry were somehow shared.
import type { FilterField } from './filter'

export interface CachedFilter {
  filter: unknown
  summary: string
}

interface Entry {
  value: CachedFilter
  expiresAt: number
}

// 5 minutes: long enough to absorb retries and double-submits, short enough
// that a schema edit (which changes the key anyway) or a genuine reconsider
// isn't served stale for long.
const TTL_MS = 5 * 60 * 1000
// Bound memory so a busy account can't grow this without limit. Oldest-inserted
// entries are evicted first (Map preserves insertion order).
const MAX_ENTRIES = 500

const store = new Map<string, Entry>()

// A stable fingerprint of the columns the model was shown. If the owner adds,
// removes, retypes, or re-options a column, the same question can map to a
// different filter — so the schema must be part of the key.
function fieldsFingerprint(fields: FilterField[]): string {
  return fields
    .map((f) => {
      const opts = Array.isArray((f as { config?: { options?: unknown } }).config?.options)
        ? [...((f as { config?: { options?: string[] } }).config!.options as string[])].sort()
        : []
      return `${f.key}:${f.type}:${opts.join('|')}`
    })
    .sort()
    .join(';')
}

function normalizeQuestion(question: string): string {
  return question.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function filterCacheKey(workspaceId: string, fields: FilterField[], question: string): string {
  return `${workspaceId}::${fieldsFingerprint(fields)}::${normalizeQuestion(question)}`
}

export function getCachedFilter(key: string, now: number = Date.now()): CachedFilter | null {
  const entry = store.get(key)
  if (!entry) return null
  if (now > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.value
}

export function setCachedFilter(key: string, value: CachedFilter, now: number = Date.now()): void {
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
  store.set(key, { value, expiresAt: now + TTL_MS })
}

// Test-only / safety hatch. Lives in a lib module (not the route) so exporting
// it does not violate the App Router "route.ts exports only handlers" rule.
export function clearFilterCache(): void {
  store.clear()
}

export const FILTER_CACHE_TTL_MS = TTL_MS
