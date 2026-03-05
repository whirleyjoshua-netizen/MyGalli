import type { Section, CanvasElement } from '@/lib/types/canvas'
import type { TabsConfig, Tab } from '@/lib/types/tabs'
import type { HeaderCardConfig } from '@/lib/types/header-card'
import type { KitPageConfig } from '@/lib/types/kit'
import type { KitConfig } from './registry'

let counter = 0
function uid(prefix: string) {
  counter++
  return `${prefix}-${Date.now()}-${counter}-${Math.random().toString(36).substr(2, 6)}`
}

function makeSection(elements: CanvasElement[], layout: 'full-width' | 'two-column' | 'three-column' = 'full-width'): Section {
  const colCount = layout === 'full-width' ? 1 : layout === 'two-column' ? 2 : 3
  const columns = []
  for (let i = 0; i < colCount; i++) {
    columns.push({
      id: uid('col'),
      elements: i === 0 ? elements : [],
    })
  }
  return { id: uid('section'), layout, columns }
}

function makeElement(type: string, overrides: Partial<CanvasElement> = {}): CanvasElement {
  return { id: uid('el'), type: type as any, ...overrides }
}

export function generateKitDisplay(kit: KitConfig, userName: string) {
  counter = 0

  // Build tabs based on kit modules
  const tabs: Tab[] = kit.modules.map(mod => {
    const tabSections: Section[] = []

    switch (mod.id) {
      case 'profile':
        // Profile card + Jersey card
        tabSections.push(
          makeSection([
            makeElement('kit-profile', {
              kitProfileKitId: kit.id,
              kitProfileData: {},
              kitProfileLayout: 'card',
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('jersey', {
              jerseyNumber: '1',
              jerseyName: userName.toUpperCase(),
              jerseyPrimaryColor: kit.color,
              jerseySecondaryColor: '#0F3D2E',
              jerseyStyle: 'classic',
              jerseySignaturesEnabled: true,
            }),
          ])
        )
        break

      case 'performance': {
        // Performance trackers (non-game-stat, non-camp)
        for (const tracker of kit.trackers.filter(t => t.category !== 'game-stat' && t.category !== 'camp-combine')) {
          tabSections.push(
            makeSection([
              makeElement('tracker', {
                trackerKitId: kit.id,
                trackerConfigId: tracker.id,
                trackerTitle: tracker.label,
                trackerColor: tracker.color,
                trackerChartType: tracker.visualization,
                trackerShowSummary: true,
                trackerTimeRange: 'all',
              }),
            ])
          )
        }
        // Workout schedule card
        tabSections.push(
          makeSection([
            makeElement('workout-schedule', {
              workoutScheduleTitle: 'Weekly Workouts',
              workoutScheduleDays: [
                { day: 'Mon', workouts: [] },
                { day: 'Tue', workouts: [] },
                { day: 'Wed', workouts: [] },
                { day: 'Thu', workouts: [] },
                { day: 'Fri', workouts: [] },
                { day: 'Sat', workouts: [] },
                { day: 'Sun', workouts: [] },
              ],
            }),
          ])
        )
        // Meal prep card
        const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
        tabSections.push(
          makeSection([
            makeElement('meal-prep', {
              mealPrepTitle: 'Meal Prep',
              mealPrepMeals: MEALS.map(mealType => ({
                mealType,
                days: DAYS.map(day => ({ day, name: '', notes: '', macros: '' })),
              })),
              mealPrepShowMacros: false,
            }),
          ])
        )
        break
      }

      case 'stats':
        // Game schedule card
        tabSections.push(
          makeSection([
            makeElement('game-schedule', {
              gameScheduleTitle: 'Game Schedule',
              gameScheduleGames: [],
              gameScheduleShowPastGames: true,
            }),
          ])
        )
        // Game-stat trackers
        for (const tracker of kit.trackers.filter(t => t.category === 'game-stat')) {
          tabSections.push(
            makeSection([
              makeElement('tracker', {
                trackerKitId: kit.id,
                trackerConfigId: tracker.id,
                trackerTitle: tracker.label,
                trackerColor: tracker.color,
                trackerChartType: tracker.visualization,
                trackerShowSummary: true,
                trackerTimeRange: 'all',
              }),
            ])
          )
        }
        // Camp/combine tracker
        for (const tracker of kit.trackers.filter(t => t.category === 'camp-combine')) {
          tabSections.push(
            makeSection([
              makeElement('tracker', {
                trackerKitId: kit.id,
                trackerConfigId: tracker.id,
                trackerTitle: tracker.label,
                trackerColor: tracker.color,
                trackerChartType: tracker.visualization,
                trackerShowSummary: true,
                trackerTimeRange: 'all',
              }),
            ])
          )
        }
        break

      case 'highlights':
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'My Highlights', level: 2 }),
            makeElement('text', { content: '<p>Add your highlight videos, photos, and media here. Use the embed element for YouTube/Hudl links.</p>' }),
          ])
        )
        break

      // Creative Kit tabs
      case 'vibes':
        tabSections.push(
          makeSection([
            makeElement('mood-board', {
              moodBoardTitle: 'Mood Board',
              moodBoardItems: [],
              moodBoardColumns: 3,
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('color-palette', {
              colorPaletteTitle: 'My Palette',
              colorPaletteColors: [
                { hex: '#FF6B6B', name: 'Coral' },
                { hex: '#4ECDC4', name: 'Teal' },
                { hex: '#45B7D1', name: 'Sky' },
                { hex: '#96CEB4', name: 'Sage' },
                { hex: '#FFEAA7', name: 'Sunshine' },
              ],
            }),
          ])
        )
        break

      case 'sounds':
        tabSections.push(
          makeSection([
            makeElement('playlist', {
              playlistTitle: 'My Playlist',
              playlistItems: [],
            }),
          ])
        )
        break

      case 'words':
        tabSections.push(
          makeSection([
            makeElement('quote-wall', {
              quoteWallTitle: 'Words I Live By',
              quoteWallQuotes: [
                { text: 'Be yourself; everyone else is already taken.', author: 'Oscar Wilde', source: '' },
              ],
            }),
          ])
        )
        break

      case 'academic-profile':
        tabSections.push(
          makeSection([
            makeElement('kit-profile', {
              kitProfileKitId: kit.id,
              kitProfileData: {},
              kitProfileLayout: 'card',
            }),
          ])
        )
        break

      case 'academics':
        tabSections.push(
          makeSection([
            makeElement('gpa-card', {
              gpaValue: '',
              gpaScale: '4.0',
              gpaWeighted: false,
              gpaLabel: 'Cumulative GPA',
              gpaTrend: '',
              gpaHonors: '',
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('course-list', {
              courseListTitle: 'My Courses',
              courseListCourses: [
                { name: 'AP English Literature', code: 'ENG-401', grade: 'A', credits: '1.0', semester: 'Fall 2025', category: 'English' },
                { name: 'AP Calculus BC', code: 'MATH-402', grade: 'A-', credits: '1.0', semester: 'Fall 2025', category: 'Math' },
                { name: 'AP Biology', code: 'SCI-401', grade: 'A', credits: '1.0', semester: 'Fall 2025', category: 'Science' },
              ],
              courseListShowGPA: true,
            }),
          ])
        )
        break

      case 'achievements':
        tabSections.push(
          makeSection([
            makeElement('awards-showcase', {
              awardsShowcaseTitle: 'Awards & Honors',
              awardsShowcaseItems: [
                { title: 'Honor Roll', issuer: 'School Name', date: '2025', description: 'Maintained GPA above 3.5', icon: 'Award' },
                { title: 'National Merit Semifinalist', issuer: 'National Merit Scholarship Program', date: '2025', description: '', icon: 'Star' },
              ],
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('test-scores', {
              testScoresTitle: 'Test Scores',
              testScoresEntries: [
                {
                  testName: 'SAT',
                  totalScore: '',
                  maxScore: '1600',
                  sections: [
                    { name: 'Evidence-Based Reading & Writing', score: '', maxScore: '800' },
                    { name: 'Math', score: '', maxScore: '800' },
                  ],
                  date: '',
                },
                {
                  testName: 'ACT',
                  totalScore: '',
                  maxScore: '36',
                  sections: [
                    { name: 'English', score: '', maxScore: '36' },
                    { name: 'Math', score: '', maxScore: '36' },
                    { name: 'Reading', score: '', maxScore: '36' },
                    { name: 'Science', score: '', maxScore: '36' },
                  ],
                  date: '',
                },
              ],
            }),
          ])
        )
        break

      case 'activities':
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Extracurricular Activities', level: 2 }),
            makeElement('text', { content: '<p>Add your clubs, organizations, volunteer work, and other activities here. Use the slash command menu to add more elements.</p>' }),
          ])
        )
        break

      case 'about':
        if (kit.id === 'academic') {
          // Academic About: profile card + bio
          tabSections.push(
            makeSection([
              makeElement('kit-profile', {
                kitProfileKitId: kit.id,
                kitProfileData: {},
                kitProfileLayout: 'card',
              }),
            ])
          )
          tabSections.push(
            makeSection([
              makeElement('heading', { content: 'About Me', level: 2 }),
              makeElement('text', { content: '<p>Share your academic journey, interests, and goals. What are you passionate about? Where do you see yourself in the future?</p>' }),
            ])
          )
        } else if (kit.id === 'creative') {
          // Creative About: profile card + bio
          tabSections.push(
            makeSection([
              makeElement('kit-profile', {
                kitProfileKitId: kit.id,
                kitProfileData: {},
                kitProfileLayout: 'card',
              }),
            ])
          )
          tabSections.push(
            makeSection([
              makeElement('heading', { content: 'About Me', level: 2 }),
              makeElement('text', { content: '<p>Tell the world who you are and what inspires you...</p>' }),
            ])
          )
        } else if (kit.id === 'resume') {
          // Resume About: profile card + summary
          tabSections.push(
            makeSection([
              makeElement('kit-profile', {
                kitProfileKitId: kit.id,
                kitProfileData: {},
                kitProfileLayout: 'card',
              }),
            ])
          )
          tabSections.push(
            makeSection([
              makeElement('heading', { content: 'About Me', level: 2 }),
              makeElement('text', { content: '<p>Write a brief professional summary here. What drives you? What are you looking for?</p>' }),
            ])
          )
        } else {
          // Athlete About
          tabSections.push(
            makeSection([
              makeElement('heading', { content: 'About Me', level: 2 }),
              makeElement('text', { content: '<p>Tell your story...</p>' }),
              makeElement('heading', { content: 'Why I Play', level: 3 }),
              makeElement('text', { content: '<p>What drives you?</p>' }),
              makeElement('heading', { content: 'Goals', level: 3 }),
              makeElement('text', { content: '<p>What are you working toward?</p>' }),
            ])
          )
        }
        break

      case 'experience':
        // Work experience + education
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Work Experience', level: 2 }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('experience-entry', {
              expCompany: 'Company Name',
              expTitle: 'Job Title',
              expLocation: 'City, State',
              expStartDate: 'Jan 2023',
              expEndDate: '',
              expCurrent: true,
              expDescription: 'Describe your key responsibilities and achievements...',
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('experience-entry', {
              expCompany: 'Previous Company',
              expTitle: 'Previous Role',
              expLocation: 'City, State',
              expStartDate: 'Jun 2020',
              expEndDate: 'Dec 2022',
              expCurrent: false,
              expDescription: 'Describe your contributions and impact...',
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Education', level: 2 }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('education-entry', {
              eduInstitution: 'University Name',
              eduDegree: 'Bachelor of Science',
              eduField: 'Computer Science',
              eduGpa: '3.8',
              eduStartDate: '2016',
              eduEndDate: '2020',
              eduHonors: 'Magna Cum Laude',
              eduDescription: '',
            }),
          ])
        )
        break

      case 'skills':
        // Skill bars + certification badges
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Technical Skills', level: 2 }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('skill-bar', {
              skillName: 'JavaScript / TypeScript',
              skillProficiency: 90,
              skillCategory: 'Languages',
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('skill-bar', {
              skillName: 'React & Next.js',
              skillProficiency: 85,
              skillCategory: 'Frameworks',
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('skill-bar', {
              skillName: 'Node.js & Express',
              skillProficiency: 80,
              skillCategory: 'Backend',
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Certifications', level: 2 }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('certification-badge', {
              certName: 'AWS Solutions Architect',
              certIssuer: 'Amazon Web Services',
              certDateObtained: 'Mar 2024',
              certExpirationDate: 'Mar 2027',
              certCredentialId: '',
              certCredentialUrl: '',
            }),
          ])
        )
        break

      case 'projects':
        // Project showcase placeholders
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Projects', level: 2 }),
            makeElement('text', { content: '<p>Showcase your best work. Add project cards, screenshots, and links below.</p>' }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Project Name', level: 3 }),
            makeElement('text', { content: '<p>Describe the project, your role, technologies used, and impact. Add images or embeds to show it off.</p>' }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Another Project', level: 3 }),
            makeElement('text', { content: '<p>Add more projects as needed using the slash command menu.</p>' }),
          ])
        )
        break

      // Wedding Kit tabs
      case 'invite':
        tabSections.push(
          makeSection([
            makeElement('kit-profile', {
              kitProfileKitId: kit.id,
              kitProfileData: {},
              kitProfileLayout: 'card',
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'You\'re Invited!', level: 2, textAlign: 'center' }),
            makeElement('text', { content: '<p style="text-align: center;">We would be honored to have you celebrate with us on our special day.</p>' }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('wedding-stats', {
              weddingStatsItems: [
                { label: 'Days Together', value: '544', icon: 'Heart' },
                { label: 'Cakes Tasted', value: '7', icon: 'Cake' },
                { label: 'Venues Visited', value: '12', icon: 'MapPin' },
                { label: 'Days Until "I Do"', value: '30', icon: 'Calendar' },
              ],
            }),
          ])
        )
        break

      case 'our-story':
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Our Love Story', level: 2, textAlign: 'center' }),
            makeElement('text', { content: '<p style="text-align: center;">Tell the story of how you met and fell in love. Your guests will love reading about your journey together.</p>' }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'How We Met', level: 3 }),
            makeElement('text', { content: '<p>Share the story of your first meeting...</p>' }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('callout', {
              calloutType: 'info',
              calloutTitle: 'Fun Facts About Us',
              calloutContent: 'Add some fun facts or quirky details about your relationship!',
            }),
          ])
        )
        break

      case 'the-day':
        tabSections.push(
          makeSection([
            makeElement('wedding-timeline', {
              weddingTimelineTitle: 'Our Wedding Day',
              weddingTimelineEvents: [
                { time: '4:00 PM', title: 'Ceremony', description: 'Exchange of vows', icon: 'Church' },
                { time: '4:45 PM', title: 'Cocktail Hour', description: 'Drinks & appetizers', icon: 'Wine' },
                { time: '6:00 PM', title: 'Reception', description: 'Dinner & toasts', icon: 'UtensilsCrossed' },
                { time: '7:30 PM', title: 'First Dance', description: 'Hit the dance floor', icon: 'Music' },
                { time: '10:00 PM', title: 'Send Off', description: 'Farewell celebration', icon: 'Sparkles' },
              ],
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('wedding-party', {
              weddingPartyTitle: 'Wedding Party',
              weddingPartyMembers: [],
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Ceremony Details', level: 3 }),
            makeElement('text', { content: '<p>Add details about the ceremony location, parking, and any other logistics your guests need to know.</p>' }),
          ])
        )
        break

      case 'rsvp':
        tabSections.push(
          makeSection([
            makeElement('wedding-rsvp', {
              weddingRsvpTitle: 'RSVP',
              weddingRsvpDeadline: '',
              weddingRsvpFields: {
                attending: true,
                plusOne: true,
                mealOptions: ['Chicken', 'Beef', 'Fish', 'Vegetarian'],
                dietaryField: true,
                songRequest: true,
              },
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('wedding-hashtags', {
              weddingHashtags: ['#ForeverUs', '#OurBigDay'],
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('comment', {
              commentTitle: 'Guestbook',
              commentRequireName: true,
              commentRequireEmail: false,
              commentModerated: false,
              commentMaxLength: 1000,
              commentTheme: 'minimal',
            }),
          ])
        )
        break

      case 'registry':
        tabSections.push(
          makeSection([
            makeElement('wedding-registry', {
              weddingRegistryTitle: 'Our Registry',
              weddingRegistryItems: [],
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Honeymoon Fund', level: 3, textAlign: 'center' }),
            makeElement('text', { content: '<p style="text-align: center;">Your presence is the greatest gift. If you wish to contribute to our honeymoon adventure, we would be so grateful.</p>' }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('callout', {
              calloutType: 'info',
              calloutTitle: 'In Loving Memory',
              calloutContent: 'We carry you in our hearts on this special day.',
            }),
          ])
        )
        break

      // Creator Kit tabs
      case 'creator-profile':
        tabSections.push(
          makeSection([
            makeElement('kit-profile', {
              kitProfileKitId: kit.id,
              kitProfileData: {},
              kitProfileLayout: 'card',
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('social-stats', {
              socialStatsTitle: 'Social Media',
              socialStatsPlatforms: [
                { platform: 'instagram', handle: '@yourhandle', followers: '0', url: '' },
                { platform: 'tiktok', handle: '@yourhandle', followers: '0', url: '' },
                { platform: 'youtube', handle: '@yourhandle', followers: '0', url: '' },
              ],
            }),
          ])
        )
        break

      case 'portfolio':
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Content Portfolio', level: 2 }),
            makeElement('text', { content: '<p>Showcase your best content — add images, embeds, and slideshows below.</p>' }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('slideshow', {
              slideshowSlides: [{ imageUrl: '', title: '', description: '' }],
              slideshowHeight: 400,
              slideshowShowOverlay: true,
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('timeline', {
              timelineTitle: 'Creator Journey',
              timelineColor: '#E040FB',
              timelineEvents: [
                { date: 'Started', title: 'Began Creating', description: 'Started posting content', icon: 'Flag', isCurrent: false },
                { date: 'Milestone', title: 'Hit 10K Followers', description: 'Reached a key audience milestone', icon: 'Trophy', isCurrent: true },
              ],
            }),
          ])
        )
        break

      case 'collabs':
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Brand Collaborations', level: 2 }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('collab-card', {
              collabTitle: 'Recent Collaborations',
              collabItems: [
                { brand: 'Brand Name', role: 'Sponsored Post', dateRange: '', description: 'Describe the partnership...', image: '', link: '' },
              ],
            }),
          ])
        )
        break

      case 'media-kit': {
        tabSections.push(
          makeSection([
            makeElement('media-kit-stats', {
              mediaKitTitle: 'Audience Demographics',
              mediaKitStats: [
                { label: 'Age Range', items: [{ name: '18–24', value: '35%' }, { name: '25–34', value: '45%' }, { name: '35+', value: '20%' }] },
                { label: 'Gender', items: [{ name: 'Female', value: '65%' }, { name: 'Male', value: '30%' }, { name: 'Other', value: '5%' }] },
              ],
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('rate-card', {
              rateCardTitle: 'Packages & Rates',
              rateCardPackages: [
                { name: 'Basic', description: 'Single post', deliverables: ['1 Feed Post', '2 Stories'], price: '$500', highlight: false },
                { name: 'Standard', description: 'Multi-platform', deliverables: ['1 Feed Post', '1 Reel/TikTok', '3 Stories'], price: '$1,200', highlight: true },
                { name: 'Premium', description: 'Full campaign', deliverables: ['2 Feed Posts', '2 Reels', '5 Stories', 'Blog Feature'], price: '$3,000', highlight: false },
              ],
            }),
          ])
        )
        // 3 KPI cards in three-column layout
        const kpiSection = makeSection([
          makeElement('kpi', { kpiLabel: 'Avg. Engagement', kpiValue: '4.2', kpiSuffix: '%', kpiColor: 'purple', kpiTrend: 'up', kpiTrendValue: '+0.5%' }),
        ], 'three-column')
        kpiSection.columns[1] = {
          id: uid('col'),
          elements: [makeElement('kpi', { kpiLabel: 'Avg. Views', kpiValue: '25K', kpiColor: 'blue', kpiTrend: 'up', kpiTrendValue: '+12%' })],
        }
        kpiSection.columns[2] = {
          id: uid('col'),
          elements: [makeElement('kpi', { kpiLabel: 'Monthly Reach', kpiValue: '150K', kpiColor: 'green', kpiTrend: 'up', kpiTrendValue: '+8%' })],
        }
        tabSections.push(kpiSection)
        break
      }

      case 'creator-contact':
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Get in Touch', level: 2, textAlign: 'center' }),
            makeElement('text', { content: '<p style="text-align: center;">Interested in working together? Leave a message below or reach out via the contact info on my profile card.</p>' }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('comment', {
              commentTitle: 'Business Inquiries',
              commentRequireName: true,
              commentRequireEmail: true,
              commentModerated: true,
              commentMaxLength: 1000,
              commentTheme: 'minimal',
            }),
          ])
        )
        break

      // Business Kit tabs
      case 'biz-home':
        tabSections.push(
          makeSection([
            makeElement('kit-profile', {
              kitProfileKitId: kit.id,
              kitProfileData: {},
              kitProfileLayout: 'card',
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('business-promo', {
              bizPromoTitle: 'Specials & Promotions',
              bizPromoItems: [
                { title: 'Grand Opening Special', description: '20% off your first visit!', badge: 'NEW', ctaText: '', ctaUrl: '' },
              ],
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'Welcome', level: 2 }),
            makeElement('text', { content: '<p>Welcome to our page! Browse our menu, check our hours, and leave a review.</p>' }),
          ])
        )
        break

      case 'biz-menu':
        tabSections.push(
          makeSection([
            makeElement('business-menu', {
              bizMenuTitle: 'Our Menu',
              bizMenuCurrency: '$',
              bizMenuCategories: [
                {
                  name: 'Appetizers',
                  items: [
                    { name: 'House Sampler', description: 'A selection of our favorites', price: '12.99', tags: ['popular'] },
                  ],
                },
                {
                  name: 'Main Dishes',
                  items: [
                    { name: 'House Special', description: 'Our signature dish', price: '18.99', tags: ['popular'] },
                    { name: 'Garden Bowl', description: 'Fresh seasonal vegetables', price: '14.99', tags: ['vegan', 'gf'] },
                  ],
                },
                {
                  name: 'Drinks',
                  items: [
                    { name: 'House Lemonade', description: 'Fresh-squeezed', price: '4.99', tags: ['new'] },
                  ],
                },
              ],
            }),
          ])
        )
        break

      case 'biz-reviews':
        tabSections.push(
          makeSection([
            makeElement('business-review', {
              bizReviewTitle: 'Customer Reviews',
              bizReviewCurated: [
                { author: 'Happy Customer', rating: 5, text: 'Amazing experience! Will definitely come back.', date: '2026-01-15', source: 'Google' },
                { author: 'Regular Visitor', rating: 4, text: 'Great food and friendly service.', date: '2026-02-01', source: 'Yelp' },
              ],
              bizReviewAllowSubmissions: true,
            }),
          ])
        )
        break

      case 'biz-info':
        tabSections.push(
          makeSection([
            makeElement('business-hours', {
              bizHoursTitle: 'Hours & Location',
              bizHoursSchedule: [
                { day: 'Monday', open: '9:00 AM', close: '9:00 PM', closed: false },
                { day: 'Tuesday', open: '9:00 AM', close: '9:00 PM', closed: false },
                { day: 'Wednesday', open: '9:00 AM', close: '9:00 PM', closed: false },
                { day: 'Thursday', open: '9:00 AM', close: '9:00 PM', closed: false },
                { day: 'Friday', open: '9:00 AM', close: '10:00 PM', closed: false },
                { day: 'Saturday', open: '10:00 AM', close: '10:00 PM', closed: false },
                { day: 'Sunday', open: '10:00 AM', close: '8:00 PM', closed: false },
              ],
              bizHoursAddress: '',
              bizHoursPhone: '',
              bizHoursEmail: '',
              bizHoursWebsite: '',
              bizHoursMapsUrl: '',
              bizHoursSpecialNote: '',
            }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('heading', { content: 'About Us', level: 2 }),
            makeElement('text', { content: '<p>Tell your customers about your business story, mission, and what makes you special.</p>' }),
          ])
        )
        tabSections.push(
          makeSection([
            makeElement('comment', {
              commentTitle: 'Questions & Feedback',
              commentRequireName: true,
              commentRequireEmail: true,
              commentModerated: true,
              commentMaxLength: 500,
              commentTheme: 'minimal',
            }),
          ])
        )
        break

      default:
        tabSections.push(makeSection([]))
    }

    // Ensure at least one section
    if (tabSections.length === 0) {
      tabSections.push(makeSection([]))
    }

    return {
      id: uid('tab'),
      label: mod.tabLabel,
      slug: mod.tabLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      sections: tabSections,
    }
  })

  const tabsConfig: TabsConfig = {
    enabled: true,
    tabs,
    style: 'pills',
    alignment: 'center',
  }

  // Header card config
  const headerCard: HeaderCardConfig = {
    enabled: true,
    template: kit.defaultHeaderCard.template,
    name: userName,
    title: '',
    subtitle: '',
    photoUrl: '',
    photoPosition: kit.defaultHeaderCard.photoPosition as any,
    actions: [],
    textAlignment: 'center',
  }

  // Kit config for the Display
  const kitConfig: KitPageConfig = {
    kitId: kit.id,
    version: 1,
    profile: {},
  }

  // Top-level sections = first tab's sections (for backward compat)
  const sections = tabs[0]?.sections || []

  return { sections, tabs: tabsConfig, headerCard, kitConfig }
}
