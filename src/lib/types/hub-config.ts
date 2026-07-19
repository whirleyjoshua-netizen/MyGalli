export const HUB_SIDEBAR_KEYS = ['video', 'members', 'events', 'resources'] as const
export type HubSidebarKey = (typeof HUB_SIDEBAR_KEYS)[number]
export type HubSidebarWidget = { key: HubSidebarKey; enabled: boolean }
export const HUB_UTILITY_KEYS = ['notes', 'ai', 'tools'] as const
export type HubUtilityKey = (typeof HUB_UTILITY_KEYS)[number]
export type HubUtilityWidget = { key: HubUtilityKey; enabled: boolean }
export type HubWhoCanPost = 'members' | 'owner-only'
export type HubWhoCanDrop = 'members' | 'owner-only'

export type HubConfig = {
  sidebar: HubSidebarWidget[]
  utility: HubUtilityWidget[]
  feed: { composerEnabled: boolean; loadMoreEnabled: boolean; emptyStateText?: string }
  access: { whoCanPost: HubWhoCanPost }
  kollab: { enabled: boolean; whoCanDrop: HubWhoCanDrop }
}

export const DEFAULT_HUB_CONFIG: HubConfig = {
  sidebar: [
    { key: 'video', enabled: true },
    { key: 'members', enabled: true },
    { key: 'events', enabled: true },
    { key: 'resources', enabled: true },
  ],
  utility: [
    { key: 'notes', enabled: true },
    { key: 'ai', enabled: true },
    { key: 'tools', enabled: true },
  ],
  feed: { composerEnabled: true, loadMoreEnabled: true },
  access: { whoCanPost: 'members' },
  kollab: { enabled: true, whoCanDrop: 'members' },
}
