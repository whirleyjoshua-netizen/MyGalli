import { registerKit, type KitConfig } from './registry'

export const CREATOR_KIT: KitConfig = {
  id: 'creator',
  name: 'Creator Kit',
  description: 'Content creator media kit — showcase your social reach, brand collabs, audience demographics, and rates.',
  icon: 'Sparkles',
  color: '#E040FB',
  defaultHeaderCard: {
    template: 'profile',
    photoPosition: 'center-overlap',
  },
  profileFields: [
    // Core
    { key: 'displayName', label: 'Display Name', type: 'text', placeholder: 'Your creator name', section: 'Core' },
    { key: 'primaryPlatform', label: 'Primary Platform', type: 'select', placeholder: '', section: 'Core',
      options: ['Instagram', 'TikTok', 'YouTube', 'Twitter/X', 'Twitch', 'LinkedIn', 'Pinterest', 'Snapchat'] },
    { key: 'contentNiche', label: 'Content Niche', type: 'text', placeholder: 'e.g. Fashion, Tech, Fitness', section: 'Core' },
    { key: 'location', label: 'Location', type: 'text', placeholder: 'City, Country', section: 'Core' },
    // Audience
    { key: 'totalReach', label: 'Total Reach', type: 'text', placeholder: 'e.g. 500K+', section: 'Audience' },
    { key: 'primaryAgeRange', label: 'Primary Age Range', type: 'text', placeholder: 'e.g. 18-34', section: 'Audience' },
    { key: 'primaryGender', label: 'Primary Gender', type: 'select', placeholder: '', section: 'Audience',
      options: ['Mostly Female', 'Mostly Male', 'Mixed'] },
    // Contact
    { key: 'businessEmail', label: 'Business Email', type: 'email', placeholder: 'you@brand.com', section: 'Contact' },
    { key: 'phone', label: 'Phone', type: 'phone', placeholder: '+1 (555) 000-0000', section: 'Contact' },
    { key: 'management', label: 'Management / Agency', type: 'text', placeholder: 'Agency name', section: 'Contact' },
    // Links
    { key: 'website', label: 'Website', type: 'url', placeholder: 'https://yoursite.com', section: 'Links' },
    { key: 'linktree', label: 'Linktree', type: 'url', placeholder: 'https://linktr.ee/you', section: 'Links' },
    { key: 'mediaKitPdf', label: 'Media Kit PDF', type: 'url', placeholder: 'https://…/media-kit.pdf', section: 'Links' },
  ],
  trackers: [],
  modules: [
    { id: 'creator-profile', label: 'Profile',   description: 'Profile card & social presence', icon: 'UserCircle', tabLabel: 'Profile' },
    { id: 'portfolio',       label: 'Portfolio',  description: 'Content showcase & journey',     icon: 'FolderOpen', tabLabel: 'Portfolio' },
    { id: 'collabs',         label: 'Collabs',    description: 'Brand partnerships',             icon: 'Briefcase',  tabLabel: 'Collabs' },
    { id: 'media-kit',       label: 'Media Kit',  description: 'Demographics & rates',           icon: 'BarChart3',  tabLabel: 'Media Kit' },
    { id: 'creator-contact', label: 'Contact',    description: 'Business inquiries',             icon: 'Mail',       tabLabel: 'Contact' },
  ],
}

registerKit(CREATOR_KIT)
