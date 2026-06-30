// Kit Registry — defines the structure and configuration for each Kit type

export interface TrackerFieldDef {
  key: string
  label: string
  type: 'number' | 'text' | 'date' | 'select' | 'boolean'
  unit?: string
  required?: boolean
  options?: string[]   // For 'select' type
  placeholder?: string
}

export interface TrackerConfig {
  id: string
  label: string
  category: string     // 'sprint', 'lift', 'body-metric', 'game-stat'
  icon: string         // Lucide icon name
  fields: TrackerFieldDef[]
  visualization: 'line' | 'bar'
  color: string        // Default chart color
}

export interface KitProfileField {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'url' | 'email' | 'phone' | 'textarea'
  placeholder?: string
  section: string      // For grouping: 'Core', 'Physical', 'Academic', etc.
  options?: string[]   // For 'select' type
}

export interface KitModuleConfig {
  id: string
  label: string
  description: string
  icon: string         // Lucide icon name
  tabLabel: string     // Label shown in tab bar
}

export interface KitConfig {
  id: string
  name: string
  description: string
  icon: string
  color: string
  profileFields: KitProfileField[]
  trackers: TrackerConfig[]
  modules: KitModuleConfig[]
  defaultHeaderCard: {
    template: 'profile' | 'resume' | 'catalog'
    photoPosition: string
  }
  pro?: boolean
}

// Global kit registry — add new kits here
export const KIT_REGISTRY: Record<string, KitConfig> = {}

export function registerKit(kit: KitConfig) {
  KIT_REGISTRY[kit.id] = kit
}

export function getKit(kitId: string): KitConfig | undefined {
  return KIT_REGISTRY[kitId]
}

export function listKits(): KitConfig[] {
  return Object.values(KIT_REGISTRY)
}
