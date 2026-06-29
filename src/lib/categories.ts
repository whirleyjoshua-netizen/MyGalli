export const CATEGORIES = [
  { id: 'sports', label: 'Sports & Athletics', icon: 'Trophy' },
  { id: 'creative', label: 'Creative & Portfolio', icon: 'Palette' },
  { id: 'professional', label: 'Professional & Resume', icon: 'Briefcase' },
  { id: 'business', label: 'Business & Promotional', icon: 'Store' },
  { id: 'personal', label: 'Personal', icon: 'User' },
  { id: 'events', label: 'Events & Celebrations', icon: 'PartyPopper' },
  { id: 'education', label: 'Education & Academic', icon: 'GraduationCap' },
  { id: 'entertainment', label: 'Entertainment & Creators', icon: 'Sparkles' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export const CATEGORY_IDS: string[] = CATEGORIES.map((c) => c.id)

export function isValidCategory(id: string): boolean {
  return CATEGORY_IDS.includes(id)
}

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? 'Other'
}
