import {
  HUB_SIDEBAR_KEYS,
  DEFAULT_HUB_CONFIG,
  type HubConfig,
  type HubSidebarKey,
  type HubWhoCanPost,
} from './types/hub-config'

const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)

// Always returns a valid HubConfig. Preserves the caller's sidebar order for
// known keys (first occurrence wins), appends any missing widgets enabled, and
// coerces every field. Runs on both write and read so a bad payload can never
// break the public render.
export function sanitizeHubConfig(raw: unknown): HubConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>

  const seen = new Set<HubSidebarKey>()
  const sidebar: HubConfig['sidebar'] = []
  if (Array.isArray(r.sidebar)) {
    for (const w of r.sidebar) {
      const key = w?.key
      if ((HUB_SIDEBAR_KEYS as readonly string[]).includes(key) && !seen.has(key)) {
        seen.add(key)
        sidebar.push({ key, enabled: bool(w?.enabled, true) })
      }
    }
  }
  for (const key of HUB_SIDEBAR_KEYS) {
    if (!seen.has(key)) sidebar.push({ key, enabled: true })
  }

  const feedRaw = (r.feed && typeof r.feed === 'object' ? r.feed : {}) as Record<string, any>
  const emptyStateText =
    typeof feedRaw.emptyStateText === 'string' ? feedRaw.emptyStateText.slice(0, 200) : undefined

  const whoCanPost: HubWhoCanPost = r.access?.whoCanPost === 'owner-only' ? 'owner-only' : 'members'

  return {
    sidebar,
    feed: {
      composerEnabled: bool(feedRaw.composerEnabled, DEFAULT_HUB_CONFIG.feed.composerEnabled),
      loadMoreEnabled: bool(feedRaw.loadMoreEnabled, DEFAULT_HUB_CONFIG.feed.loadMoreEnabled),
      ...(emptyStateText !== undefined ? { emptyStateText } : {}),
    },
    access: { whoCanPost },
  }
}

export function canPostWithAccess(input: {
  canParticipate: boolean
  whoCanPost: HubWhoCanPost
  isPrivileged: boolean
}): boolean {
  if (input.whoCanPost === 'owner-only') return input.isPrivileged
  return input.canParticipate
}

// Stable stringify (sorted keys) so autosave can skip identical payloads.
export function buildHubPayloadKey(payload: unknown): string {
  return JSON.stringify(payload, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )
}
