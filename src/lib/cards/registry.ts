// Card Provider Registry
// Adding a new provider = one entry here + one renderer component (builtin)
// or an iframe URL (external)

export interface CardField {
  key: string
  label: string
  type: 'text' | 'url' | 'textarea' | 'number' | 'select'
  placeholder?: string
  required?: boolean
  options?: { label: string; value: string }[]
}

export interface CardProviderConfig {
  id: string
  name: string
  description: string
  icon: string // Lucide icon name
  type: 'builtin' | 'external'
  iframeUrl?: string // Required when type is 'external'
  defaultData: Record<string, any>
  fields: CardField[]
  listed?: boolean // appears on the Apps storefront
  status?: 'live' | 'coming-soon' // live = addable; coming-soon = visible only
}

export const CARD_PROVIDERS: Record<string, CardProviderConfig> = {
  vouch: {
    id: 'vouch',
    listed: true,
    status: 'live',
    name: 'Vouch',
    description: 'Verified professional credibility card — mutual references, achievements, reviews',
    icon: 'ShieldCheck',
    type: 'external',
    iframeUrl: '/sdk/vouch-card.html',
    defaultData: {
      name: 'Josh M.',
      title: 'Founder & CEO',
      company: 'VerifyLink Infrastructure',
      avatarUrl: '',
      verified: 6,
      references: [
        { name: 'Sarah Chen', title: 'VP Engineering', company: 'Northrop Grumman', relationshipType: 'manager' },
        { name: 'Marcus Webb', title: 'Senior Contractor', company: 'Leidos', relationshipType: 'peer' },
        { name: 'Diana Reeves', title: 'Program Manager', company: 'SAIC', relationshipType: 'peer' },
        { name: 'Tyler Brooks', title: 'Lead Developer', company: 'Palantir', relationshipType: 'report' },
        { name: 'Angela Moretti', title: 'CISO', company: 'BAE Systems', relationshipType: 'manager' },
        { name: 'Raj Patel', title: 'Solutions Architect', company: 'AWS GovCloud', relationshipType: 'peer' },
      ],
      achievements: [
        { type: 'leadership', title: 'Team Growth Leader' },
        { type: 'delivery', title: 'Q4 Ship Excellence' },
        { type: 'security', title: 'Zero Incidents' },
        { type: 'mentorship', title: 'Mentorship Champion' },
      ],
      standout: 'One of the most technically sharp and reliable people I have ever worked with. Consistently delivers under pressure and elevates everyone around them.',
      standoutFrom: 'Sarah Chen, VP Engineering',
      latestRating: 'Exceeds Expectations',
      latestPeriod: 'Q4 2025',
      latestMerit: '+8%',
    },
    fields: [
      { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Josh M.', required: true },
      { key: 'title', label: 'Job Title', type: 'text', placeholder: 'Founder & CEO' },
      { key: 'company', label: 'Company', type: 'text', placeholder: 'VerifyLink Infrastructure' },
      { key: 'avatarUrl', label: 'Avatar URL', type: 'url', placeholder: 'https://...' },
      { key: 'verified', label: 'Verified References', type: 'number', placeholder: '6' },
      { key: 'standout', label: 'Standout Quote', type: 'textarea', placeholder: 'What makes this person stand out...' },
      { key: 'standoutFrom', label: 'Quote Attribution', type: 'text', placeholder: 'Sarah Chen, VP Engineering' },
      { key: 'latestRating', label: 'Latest Review Rating', type: 'text', placeholder: 'Exceeds Expectations' },
      { key: 'latestPeriod', label: 'Review Period', type: 'text', placeholder: 'Q4 2025' },
      { key: 'latestMerit', label: 'Merit Increase', type: 'text', placeholder: '+8%' },
    ],
  },
  example: {
    id: 'example',
    listed: false,
    name: 'Example Card',
    description: 'Developer template — external iframe card',
    icon: 'ExternalLink',
    type: 'external',
    iframeUrl: '/sdk/example-card.html',
    defaultData: {
      title: 'Hello World',
      description: 'This is an example external card',
      color: '#39D98A',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', placeholder: 'Card title', required: true },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Card description' },
      { key: 'color', label: 'Accent Color', type: 'text', placeholder: '#39D98A' },
    ],
  },
  kollabshare: {
    id: 'kollabshare',
    name: 'KollabShare',
    description: 'Collaborative sharing widget — coming soon to My Galli.',
    icon: 'Share2',
    type: 'external',
    listed: true,
    status: 'coming-soon',
    defaultData: {},
    fields: [],
  },
}

// Register an external card at runtime
export function registerExternalCard(config: CardProviderConfig): void {
  if (config.type !== 'external' || !config.iframeUrl) {
    throw new Error('External cards must have type "external" and an iframeUrl')
  }
  CARD_PROVIDERS[config.id] = config
}

// Providers shown on the Apps storefront
export function listedApps(): CardProviderConfig[] {
  return Object.values(CARD_PROVIDERS).filter((p) => p.listed)
}

// Achievement type icons + colors (maps to Vouch's 12 types)
export const ACHIEVEMENT_ICONS: Record<string, { icon: string; color: string }> = {
  delivery: { icon: 'Package', color: '#3b82f6' },
  quality: { icon: 'Star', color: '#f59e0b' },
  speed: { icon: 'Zap', color: '#ef4444' },
  impact: { icon: 'TrendingUp', color: '#10b981' },
  leadership: { icon: 'Crown', color: '#8b5cf6' },
  mentorship: { icon: 'Users', color: '#06b6d4' },
  innovation: { icon: 'Lightbulb', color: '#f97316' },
  reliability: { icon: 'Shield', color: '#64748b' },
  collaboration: { icon: 'Handshake', color: '#ec4899' },
  security: { icon: 'Lock', color: '#14b8a6' },
  compliance: { icon: 'ClipboardCheck', color: '#6366f1' },
  growth: { icon: 'Sprout', color: '#22c55e' },
}
