export const HUB_SIDEBAR_KEYS = ['video', 'members', 'resources'] as const
export type HubSidebarKey = (typeof HUB_SIDEBAR_KEYS)[number]
export type HubSidebarWidget = { key: HubSidebarKey; enabled: boolean }
export type HubWhoCanPost = 'members' | 'owner-only'

export type HubConfig = {
  sidebar: HubSidebarWidget[]
  feed: { composerEnabled: boolean; loadMoreEnabled: boolean; emptyStateText?: string }
  access: { whoCanPost: HubWhoCanPost }
}

export const DEFAULT_HUB_CONFIG: HubConfig = {
  sidebar: [
    { key: 'video', enabled: true },
    { key: 'members', enabled: true },
    { key: 'resources', enabled: true },
  ],
  feed: { composerEnabled: true, loadMoreEnabled: true },
  access: { whoCanPost: 'members' },
}
