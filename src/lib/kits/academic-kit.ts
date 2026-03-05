import { registerKit, type KitConfig } from './registry'

export const ACADEMIC_KIT: KitConfig = {
  id: 'academic',
  name: 'Academic Kit',
  description: 'Flexible academic portfolio for high school and college students — GPA, courses, test scores, awards, and extracurriculars.',
  icon: 'Library',
  color: '#6C63FF',
  defaultHeaderCard: {
    template: 'profile',
    photoPosition: 'left',
  },
  profileFields: [
    // Core
    { key: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Your full name', section: 'Core' },
    { key: 'school', label: 'School', type: 'text', placeholder: 'School name', section: 'Core' },
    { key: 'graduationYear', label: 'Graduation Year', type: 'select', placeholder: 'Select year', section: 'Core', options: ['2025', '2026', '2027', '2028', '2029', '2030'] },
    { key: 'major', label: 'Major / Focus', type: 'text', placeholder: 'e.g. Computer Science', section: 'Core' },
    { key: 'gradeLevel', label: 'Grade Level', type: 'select', placeholder: 'Select level', section: 'Core', options: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'College Freshman', 'College Sophomore', 'College Junior', 'College Senior'] },
    // Academic
    { key: 'gpa', label: 'GPA', type: 'text', placeholder: '4.0', section: 'Academic' },
    { key: 'weightedGpa', label: 'Weighted GPA', type: 'text', placeholder: '4.5', section: 'Academic' },
    { key: 'satScore', label: 'SAT Score', type: 'text', placeholder: '1600', section: 'Academic' },
    { key: 'actScore', label: 'ACT Score', type: 'text', placeholder: '36', section: 'Academic' },
    { key: 'classRank', label: 'Class Rank', type: 'text', placeholder: 'e.g. 5/350', section: 'Academic' },
    // Contact
    { key: 'email', label: 'Email', type: 'email', placeholder: 'you@school.edu', section: 'Contact' },
    { key: 'phone', label: 'Phone', type: 'phone', placeholder: '(555) 123-4567', section: 'Contact' },
    // Links
    { key: 'linkedIn', label: 'LinkedIn', type: 'url', placeholder: 'https://linkedin.com/in/...', section: 'Links' },
    { key: 'portfolio', label: 'Portfolio', type: 'url', placeholder: 'https://yoursite.com', section: 'Links' },
    // Other
    { key: 'interests', label: 'Interests', type: 'textarea', placeholder: 'Academic interests, hobbies, goals...', section: 'Other' },
  ],
  trackers: [],
  modules: [
    { id: 'academic-profile', label: 'Profile', description: 'Academic profile card', icon: 'UserCircle', tabLabel: 'Profile' },
    { id: 'academics', label: 'Academics', description: 'GPA and course list', icon: 'BookOpen', tabLabel: 'Academics' },
    { id: 'achievements', label: 'Achievements', description: 'Awards and test scores', icon: 'Award', tabLabel: 'Achievements' },
    { id: 'activities', label: 'Activities', description: 'Extracurricular activities', icon: 'Users', tabLabel: 'Activities' },
    { id: 'about', label: 'About', description: 'Bio and personal statement', icon: 'UserCircle', tabLabel: 'About' },
  ],
}

registerKit(ACADEMIC_KIT)
