import { registerKit, type KitConfig } from './registry'

export const CREATIVE_KIT: KitConfig = {
  id: 'creative',
  pro: true,
  name: 'Personal Creative Kit',
  description: 'Flexible creative elements for self-expression — mood boards, color palettes, playlists, and quote walls.',
  icon: 'Sparkles',
  color: '#FF6B6B',
  defaultHeaderCard: {
    template: 'profile',
    photoPosition: 'center-overlap',
  },
  profileFields: [
    { key: 'displayName', label: 'Display Name', type: 'text', placeholder: 'Your creative alias', section: 'Core' },
    { key: 'tagline', label: 'Tagline', type: 'text', placeholder: 'A few words about you', section: 'Core' },
    { key: 'location', label: 'Location', type: 'text', placeholder: 'City, Country', section: 'Core' },
    { key: 'website', label: 'Website', type: 'url', placeholder: 'https://yoursite.com', section: 'Links' },
    { key: 'instagram', label: 'Instagram', type: 'text', placeholder: '@handle', section: 'Links' },
  ],
  trackers: [],
  modules: [
    { id: 'vibes', label: 'Vibes', description: 'Mood board and color palette', icon: 'Palette', tabLabel: 'Vibes' },
    { id: 'sounds', label: 'Sounds', description: 'Your playlist', icon: 'Music', tabLabel: 'Sounds' },
    { id: 'words', label: 'Words', description: 'Quote wall', icon: 'Quote', tabLabel: 'Words' },
    { id: 'about', label: 'About', description: 'Profile and bio', icon: 'UserCircle', tabLabel: 'About' },
  ],
}

registerKit(CREATIVE_KIT)
