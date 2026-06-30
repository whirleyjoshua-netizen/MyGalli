import { registerKit, type KitConfig } from './registry'

export const WEDDING_KIT: KitConfig = {
  id: 'wedding',
  pro: true,
  name: 'Wedding Kit',
  description: 'Digital wedding suite — invites, RSVP, timeline, guestbook, and registry all in one living page.',
  icon: 'Heart',
  color: '#E8B4B8',
  defaultHeaderCard: {
    template: 'profile',
    photoPosition: 'center-overlap',
  },
  profileFields: [
    { key: 'partner1', label: 'Partner 1 Name', type: 'text', placeholder: 'e.g. Sarah', section: 'Couple' },
    { key: 'partner2', label: 'Partner 2 Name', type: 'text', placeholder: 'e.g. James', section: 'Couple' },
    { key: 'weddingDate', label: 'Wedding Date', type: 'text', placeholder: 'e.g. June 15, 2026', section: 'Details' },
    { key: 'venue', label: 'Venue', type: 'text', placeholder: 'e.g. The Grand Estate', section: 'Details' },
    { key: 'venueAddress', label: 'Venue Address', type: 'textarea', placeholder: '123 Garden Lane, City, State', section: 'Details' },
    { key: 'dressCode', label: 'Dress Code', type: 'text', placeholder: 'e.g. Black Tie, Cocktail', section: 'Details' },
    { key: 'contactEmail', label: 'Contact Email', type: 'email', placeholder: 'rsvp@ourevent.com', section: 'Contact' },
    { key: 'contactPhone', label: 'Contact Phone', type: 'phone', placeholder: '(555) 123-4567', section: 'Contact' },
    { key: 'websiteUrl', label: 'Wedding Website', type: 'url', placeholder: 'https://ourwedding.com', section: 'Links' },
  ],
  trackers: [],
  modules: [
    { id: 'invite', label: 'Invite', description: 'Welcome message and couple info', icon: 'Heart', tabLabel: 'Invite' },
    { id: 'our-story', label: 'Our Story', description: 'Your love story and journey', icon: 'BookOpen', tabLabel: 'Our Story' },
    { id: 'the-day', label: 'The Day', description: 'Timeline and wedding party', icon: 'Calendar', tabLabel: 'The Day' },
    { id: 'rsvp', label: 'RSVP', description: 'Guest RSVP and guestbook', icon: 'Mail', tabLabel: 'RSVP' },
    { id: 'registry', label: 'Registry', description: 'Gift registry and honeymoon fund', icon: 'Gift', tabLabel: 'Registry' },
  ],
}

registerKit(WEDDING_KIT)
