import { registerKit, type KitConfig } from './registry'

export const ATHLETE_KIT: KitConfig = {
  id: 'athlete',
  pro: true,
  name: 'Athlete Kit',
  description: 'Performance Identity Kit — track progress, showcase stats, and tell your athletic story.',
  icon: 'Trophy',
  color: '#39D98A',
  defaultHeaderCard: {
    template: 'profile',
    photoPosition: 'center-overlap',
  },
  profileFields: [
    // Core
    { key: 'sport', label: 'Sport', type: 'text', placeholder: 'e.g. Football, Basketball', section: 'Core' },
    { key: 'position', label: 'Position', type: 'text', placeholder: 'e.g. QB, Point Guard', section: 'Core' },
    { key: 'classYear', label: 'Class Year', type: 'select', section: 'Core', options: ['2025', '2026', '2027', '2028', '2029', '2030'] },
    { key: 'school', label: 'School', type: 'text', placeholder: 'Current school name', section: 'Core' },
    // Physical
    { key: 'height', label: 'Height', type: 'text', placeholder: `e.g. 6'2"`, section: 'Physical' },
    { key: 'weight', label: 'Weight (lbs)', type: 'number', placeholder: '185', section: 'Physical' },
    // Academic
    { key: 'gpa', label: 'GPA', type: 'text', placeholder: '3.8', section: 'Academic' },
    // Contact
    { key: 'coachName', label: 'Coach Name', type: 'text', placeholder: 'Head coach', section: 'Contact' },
    { key: 'coachEmail', label: 'Coach Email', type: 'email', placeholder: 'coach@school.edu', section: 'Contact' },
    { key: 'coachPhone', label: 'Coach Phone', type: 'phone', placeholder: '(555) 123-4567', section: 'Contact' },
    // Recruiting
    { key: 'recruitingStatus', label: 'Recruiting Status', type: 'select', section: 'Recruiting', options: ['Uncommitted', 'Committed', 'Signed', 'Not Recruiting'] },
    { key: 'desiredSchools', label: 'Target Schools', type: 'textarea', placeholder: 'List dream schools...', section: 'Recruiting' },
    // Links
    { key: 'hudlUrl', label: 'Hudl Profile', type: 'url', placeholder: 'https://hudl.com/...', section: 'Links' },
    { key: 'maxprepsUrl', label: 'MaxPreps', type: 'url', placeholder: 'https://maxpreps.com/...', section: 'Links' },
    { key: 'youtubeUrl', label: 'YouTube Channel', type: 'url', placeholder: 'https://youtube.com/...', section: 'Links' },
    // Social
    { key: 'socialHandles', label: 'Social / X / Instagram', type: 'text', placeholder: '@handle', section: 'Social' },
  ],
  trackers: [
    {
      id: 'forty-yard',
      label: '40-Yard Dash',
      category: 'sprint',
      icon: 'Zap',
      color: '#39D98A',
      visualization: 'line',
      fields: [
        { key: 'time', label: 'Time', type: 'number', unit: 'sec', required: true, placeholder: '4.52' },
        { key: 'surface', label: 'Surface', type: 'select', options: ['Turf', 'Grass', 'Track', 'Indoor'] },
        { key: 'electronic', label: 'Electronic Timing', type: 'boolean' },
      ],
    },
    {
      id: 'lift',
      label: 'Lift Tracker',
      category: 'lift',
      icon: 'Dumbbell',
      color: '#6C63FF',
      visualization: 'line',
      fields: [
        { key: 'exercise', label: 'Exercise', type: 'select', required: true, options: ['Bench Press', 'Squat', 'Deadlift', 'Power Clean', 'Hang Clean', 'Overhead Press', 'Incline Bench', 'Front Squat', 'Other'] },
        { key: 'weight', label: 'Weight', type: 'number', unit: 'lbs', required: true, placeholder: '225' },
        { key: 'reps', label: 'Reps', type: 'number', required: true, placeholder: '5' },
        { key: 'sets', label: 'Sets', type: 'number', placeholder: '3' },
        { key: 'isPR', label: 'Personal Record?', type: 'boolean' },
      ],
    },
    {
      id: 'body-metrics',
      label: 'Body Metrics',
      category: 'body-metric',
      icon: 'Activity',
      color: '#1FB6FF',
      visualization: 'line',
      fields: [
        { key: 'bodyWeight', label: 'Body Weight', type: 'number', unit: 'lbs', placeholder: '185' },
        { key: 'bodyFat', label: 'Body Fat %', type: 'number', unit: '%', placeholder: '12' },
      ],
    },
    {
      id: 'game-stats',
      label: 'Game Stats',
      category: 'game-stat',
      icon: 'Trophy',
      color: '#F59E0B',
      visualization: 'bar',
      fields: [
        { key: 'opponent', label: 'Opponent', type: 'text', required: true, placeholder: 'vs. Rival High' },
        { key: 'result', label: 'Result', type: 'select', options: ['Win', 'Loss', 'Tie'] },
        { key: 'tag', label: 'Game Type', type: 'select', options: ['Regular Season', 'Playoff', 'Rivalry', 'Tournament', 'Scrimmage'] },
        { key: 'stat1', label: 'Stat 1', type: 'text', placeholder: 'e.g. 15 pts' },
        { key: 'stat2', label: 'Stat 2', type: 'text', placeholder: 'e.g. 8 reb' },
        { key: 'stat3', label: 'Stat 3', type: 'text', placeholder: 'e.g. 5 ast' },
      ],
    },
    {
      id: 'camp-combine',
      label: 'Camp & Combine',
      category: 'camp-combine',
      icon: 'MapPin',
      color: '#E74C3C',
      visualization: 'bar',
      fields: [
        { key: 'eventName', label: 'Event Name', type: 'text', required: true, placeholder: 'e.g. Nike Football Camp' },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Orlando, FL' },
        { key: 'eventType', label: 'Type', type: 'select', options: ['Camp', 'Combine', 'Showcase', 'Tryout'] },
        { key: 'resultNotes', label: 'Result / Notes', type: 'text', placeholder: 'e.g. Received MVP award' },
      ],
    },
  ],
  modules: [
    { id: 'profile', label: 'Profile', description: 'Your athlete identity card', icon: 'UserCircle', tabLabel: 'Profile' },
    { id: 'performance', label: 'Performance', description: 'Track speed, strength, and body metrics', icon: 'TrendingUp', tabLabel: 'Performance' },
    { id: 'stats', label: 'Stats', description: 'Game-by-game statistics', icon: 'BarChart3', tabLabel: 'Stats' },
    { id: 'highlights', label: 'Highlights', description: 'Video highlights and media', icon: 'Play', tabLabel: 'Highlights' },
    { id: 'about', label: 'About Me', description: 'Your story, goals, and journey', icon: 'BookOpen', tabLabel: 'About Me' },
  ],
}

// Self-register on import
registerKit(ATHLETE_KIT)
