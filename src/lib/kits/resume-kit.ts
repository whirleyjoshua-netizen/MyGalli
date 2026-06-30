import { registerKit, type KitConfig } from './registry'

export const RESUME_KIT: KitConfig = {
  id: 'resume',
  pro: true,
  name: 'Resume Kit',
  description: 'Professional identity page — showcase experience, skills, education, and projects.',
  icon: 'FileText',
  color: '#6C63FF',
  defaultHeaderCard: {
    template: 'profile',
    photoPosition: 'left',
  },
  profileFields: [
    // Core
    { key: 'headline', label: 'Headline / Title', type: 'text', placeholder: 'e.g. Full-Stack Developer', section: 'Core' },
    { key: 'location', label: 'Location', type: 'text', placeholder: 'e.g. San Francisco, CA', section: 'Core' },
    { key: 'yearsExperience', label: 'Years of Experience', type: 'text', placeholder: 'e.g. 5+', section: 'Core' },
    // Contact
    { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', section: 'Contact' },
    { key: 'phone', label: 'Phone', type: 'phone', placeholder: '(555) 123-4567', section: 'Contact' },
    { key: 'website', label: 'Website', type: 'url', placeholder: 'https://yoursite.com', section: 'Contact' },
    // Links
    { key: 'linkedinUrl', label: 'LinkedIn', type: 'url', placeholder: 'https://linkedin.com/in/...', section: 'Links' },
    { key: 'githubUrl', label: 'GitHub', type: 'url', placeholder: 'https://github.com/...', section: 'Links' },
    { key: 'portfolioUrl', label: 'Portfolio', type: 'url', placeholder: 'https://portfolio.com/...', section: 'Links' },
    { key: 'twitterUrl', label: 'Twitter / X', type: 'url', placeholder: 'https://x.com/...', section: 'Links' },
    // Summary
    { key: 'summary', label: 'Professional Summary', type: 'textarea', placeholder: 'Brief professional summary or objective statement...', section: 'Summary' },
  ],
  trackers: [],
  modules: [
    { id: 'about', label: 'About', description: 'Profile card and professional summary', icon: 'UserCircle', tabLabel: 'About' },
    { id: 'experience', label: 'Experience', description: 'Work history and education', icon: 'Briefcase', tabLabel: 'Experience' },
    { id: 'skills', label: 'Skills & Certs', description: 'Technical skills and certifications', icon: 'Award', tabLabel: 'Skills & Certs' },
    { id: 'projects', label: 'Projects', description: 'Project showcase and case studies', icon: 'FolderOpen', tabLabel: 'Projects' },
  ],
}

registerKit(RESUME_KIT)
