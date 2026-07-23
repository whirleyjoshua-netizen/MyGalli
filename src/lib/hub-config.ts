import {
  HUB_SIDEBAR_KEYS,
  HUB_UTILITY_KEYS,
  DEFAULT_HUB_CONFIG,
  type HubConfig,
  type HubSidebarKey,
  type HubUtilityKey,
  type HubWhoCanPost,
  type HubWhoCanDrop,
} from './types/hub-config'
import { isHubThemeKey } from './hub-themes'

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

  const seenUtility = new Set<HubUtilityKey>()
  const utility: HubConfig['utility'] = []
  if (Array.isArray(r.utility)) {
    for (const w of r.utility) {
      const key = w?.key
      if ((HUB_UTILITY_KEYS as readonly string[]).includes(key) && !seenUtility.has(key)) {
        seenUtility.add(key)
        utility.push({ key, enabled: bool(w?.enabled, true) })
      }
    }
  }
  for (const key of HUB_UTILITY_KEYS) {
    if (!seenUtility.has(key)) utility.push({ key, enabled: true })
  }

  const feedRaw = (r.feed && typeof r.feed === 'object' ? r.feed : {}) as Record<string, any>
  const emptyStateText =
    typeof feedRaw.emptyStateText === 'string' ? feedRaw.emptyStateText.slice(0, 200) : undefined

  const whoCanPost: HubWhoCanPost = r.access?.whoCanPost === 'owner-only' ? 'owner-only' : 'members'

  const kollabRaw = (r.kollab && typeof r.kollab === 'object' ? r.kollab : {}) as Record<string, any>
  const whoCanDrop: HubWhoCanDrop = kollabRaw.whoCanDrop === 'owner-only' ? 'owner-only' : 'members'

  // An absent or unrecognised theme renders as Galli — the value every hub
  // created before themes existed will take.
  const appearanceRaw = (r.appearance && typeof r.appearance === 'object' ? r.appearance : {}) as Record<string, any>
  const theme = isHubThemeKey(appearanceRaw.theme) ? appearanceRaw.theme : 'galli'

  return {
    sidebar,
    utility,
    feed: {
      composerEnabled: bool(feedRaw.composerEnabled, DEFAULT_HUB_CONFIG.feed.composerEnabled),
      loadMoreEnabled: bool(feedRaw.loadMoreEnabled, DEFAULT_HUB_CONFIG.feed.loadMoreEnabled),
      ...(emptyStateText !== undefined ? { emptyStateText } : {}),
    },
    access: { whoCanPost },
    // A legacy `requireApproval` key on a stored config is ignored, not an
    // error — review is mandatory now, so there is nothing left to configure.
    kollab: {
      enabled: bool(kollabRaw.enabled, DEFAULT_HUB_CONFIG.kollab.enabled),
      whoCanDrop,
    },
    appearance: { theme },
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

export function canDropToPool(input: {
  canParticipate: boolean
  whoCanDrop: HubWhoCanDrop
  isPrivileged: boolean
}): boolean {
  if (input.whoCanDrop === 'owner-only') return input.isPrivileged
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
