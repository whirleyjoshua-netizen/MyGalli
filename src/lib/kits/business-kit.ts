import { registerKit, type KitConfig } from './registry'

export const BUSINESS_KIT: KitConfig = {
  id: 'business',
  pro: true,
  name: 'Business Kit',
  description: 'For storefronts, shops, restaurants & local businesses — menus, hours, reviews, and promotions.',
  icon: 'Store',
  color: '#F59E0B',
  defaultHeaderCard: {
    template: 'catalog',
    photoPosition: 'center-overlap',
  },
  profileFields: [
    { key: 'displayName', label: 'Business Name', type: 'text', placeholder: 'Your business name', section: 'Core' },
    { key: 'tagline', label: 'Tagline', type: 'text', placeholder: 'A short description', section: 'Core' },
    { key: 'businessType', label: 'Business Type', type: 'text', placeholder: 'Restaurant, Retail, etc.', section: 'Core' },
    { key: 'phone', label: 'Phone', type: 'text', placeholder: '(555) 123-4567', section: 'Contact' },
    { key: 'email', label: 'Email', type: 'text', placeholder: 'hello@business.com', section: 'Contact' },
    { key: 'website', label: 'Website', type: 'url', placeholder: 'https://yourbusiness.com', section: 'Contact' },
    { key: 'address', label: 'Address', type: 'text', placeholder: '123 Main St, City, State', section: 'Contact' },
    { key: 'instagram', label: 'Instagram', type: 'text', placeholder: '@handle', section: 'Social' },
    { key: 'facebook', label: 'Facebook', type: 'text', placeholder: 'facebook.com/page', section: 'Social' },
    { key: 'yelp', label: 'Yelp', type: 'url', placeholder: 'Yelp listing URL', section: 'Social' },
    { key: 'googleMaps', label: 'Google Maps', type: 'url', placeholder: 'Google Maps link', section: 'Social' },
  ],
  trackers: [],
  modules: [
    { id: 'biz-home', label: 'Home', description: 'Profile and promotions', icon: 'Store', tabLabel: 'Home' },
    { id: 'biz-menu', label: 'Menu', description: 'Products & pricing', icon: 'UtensilsCrossed', tabLabel: 'Menu' },
    { id: 'biz-reviews', label: 'Reviews', description: 'Customer reviews', icon: 'Star', tabLabel: 'Reviews' },
    { id: 'biz-info', label: 'Info', description: 'Hours, location & about', icon: 'Clock', tabLabel: 'Info' },
  ],
}

registerKit(BUSINESS_KIT)
