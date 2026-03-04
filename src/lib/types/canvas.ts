// Canvas Types - Section/Column/Element Architecture
import type { CSSProperties } from 'react'

// Text styling (applicable to text, heading, quote, callout, list)
export interface TextStyle {
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  fontStyle?: 'normal' | 'italic'
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  textColor?: string
  letterSpacing?: number
  lineHeight?: number
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
}

// Convert text style fields to React inline styles
export function getTextStyles(element: Partial<TextStyle>): CSSProperties {
  const styles: CSSProperties = {}
  if (element.fontFamily) styles.fontFamily = `"${element.fontFamily}", sans-serif`
  if (element.fontSize) styles.fontSize = `${element.fontSize}px`
  if (element.fontWeight) styles.fontWeight = element.fontWeight
  if (element.fontStyle) styles.fontStyle = element.fontStyle
  if (element.textAlign) styles.textAlign = element.textAlign
  if (element.textColor) styles.color = element.textColor
  if (element.letterSpacing != null) styles.letterSpacing = `${element.letterSpacing}em`
  if (element.lineHeight != null) styles.lineHeight = element.lineHeight
  if (element.textTransform) styles.textTransform = element.textTransform
  return styles
}

// Layout modes for sections
export type LayoutMode = 'full-width' | 'two-column' | 'three-column'

// Element types (Tier 1 + Tier 2 + Tier 3)
export type ElementType =
  | 'text'
  | 'heading'
  | 'image'
  | 'embed'
  | 'button'
  | 'list'
  | 'quote'
  // Tier 2: Differentiators
  | 'kpi'
  | 'table'
  | 'callout'
  | 'toggle'
  // Tier 3: Form elements
  | 'mcq'       // Multiple choice question
  | 'rating'    // Star/numeric rating
  | 'shortanswer' // Short text input
  // Tier 3: Premium elements
  | 'chart'     // Bar, line, pie charts with 3D effects
  // Tier 3: Premium elements
  | 'code'      // Code block with syntax highlighting
  // Tier 4: Social / Engagement
  | 'comment'   // Comment section for visitor feedback
  | 'poll'      // Poll with voting
  // Tier 5: Integration cards (on hold)
  | 'card'      // App cards (Vouch, custom)
  // Kit elements
  | 'tracker'      // Time-series tracker (speed, lifts, metrics, stats)
  | 'kit-profile'  // Structured profile card for kit pages
  | 'game-schedule'  // Upcoming games table
  | 'workout-schedule'  // Weekly workout planner grid
  | 'meal-prep'    // Weekly meal planner grid
  | 'jersey'       // Interactive jersey card with signatures
  // Resume Kit elements
  | 'experience-entry'      // Job/role card
  | 'education-entry'       // School/degree card
  | 'skill-bar'             // Skill proficiency bar
  | 'certification-badge'   // Certification card
  // Wedding Kit elements
  | 'wedding-timeline'      // Visual event timeline
  | 'wedding-party'         // Wedding party roster
  | 'wedding-rsvp'          // Interactive RSVP form
  | 'wedding-stats'         // Fun stat counters
  | 'wedding-registry'      // Gift registry links
  | 'wedding-hashtags'      // Social media hashtags

// Base element interface
export interface CanvasElement {
  id: string
  type: ElementType
  content?: string
  // Heading specific
  level?: 1 | 2 | 3 | 4 | 5 | 6
  // Image specific
  url?: string
  alt?: string
  caption?: string
  // Embed specific
  embedUrl?: string
  embedType?: 'youtube' | 'vimeo' | 'twitter' | 'other'
  // Button specific
  buttonText?: string
  buttonUrl?: string
  buttonVariant?: 'solid' | 'outline' | 'ghost'
  buttonColor?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'slate'
  buttonAlign?: 'left' | 'center' | 'right'
  // List specific
  listType?: 'bulleted' | 'numbered'
  listTitle?: string
  listColumns?: 1 | 2 | 3
  items?: string[]
  // Quote specific
  quoteText?: string
  quoteAuthor?: string
  // KPI/Stat specific
  kpiLabel?: string
  kpiValue?: string
  kpiPrefix?: string
  kpiSuffix?: string
  kpiTrend?: 'up' | 'down' | 'neutral'
  kpiTrendValue?: string
  kpiColor?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'slate'
  // Table specific
  tableHeaders?: string[]
  tableRows?: string[][]
  // Callout specific
  calloutType?: 'info' | 'warning' | 'success' | 'error'
  calloutTitle?: string
  calloutContent?: string
  // Toggle specific
  toggleTitle?: string
  toggleContent?: string
  toggleOpen?: boolean
  // MCQ (Multiple Choice Question) specific
  mcqQuestion?: string
  mcqOptions?: string[]
  mcqAllowMultiple?: boolean
  mcqRequired?: boolean
  // Rating specific
  ratingQuestion?: string
  ratingMax?: number  // 5 or 10
  ratingStyle?: 'stars' | 'numeric'
  ratingRequired?: boolean
  // Short Answer specific
  shortAnswerQuestion?: string
  shortAnswerPlaceholder?: string
  shortAnswerRequired?: boolean
  shortAnswerMaxLength?: number
  // Chart specific
  chartType?: 'bar' | 'line' | 'pie'
  chartTitle?: string
  chartData?: { label: string; value: number; color?: string }[]
  chartMultiLineData?: {
    labels: string[]
    series: { name: string; color: string; values: number[] }[]
    yAxisLabels?: string[]
  }
  chartEnable3D?: boolean
  chartEnableGlow?: boolean
  chartEnableGradient?: boolean
  chartShowValues?: boolean
  chartShowLegend?: boolean
  chartShowGrid?: boolean
  chartNodeSize?: number  // Line chart dot size in px (0 = hidden, default 8)
  // Code block specific
  codeContent?: string
  codeLanguage?: string
  codeTheme?: 'dark' | 'light'
  codeShowLineNumbers?: boolean
  codeFilename?: string
  // Card specific
  cardProvider?: string    // 'vouch' | 'custom'
  cardData?: Record<string, any>  // Provider-specific data (JSON)
  cardStyle?: 'default' | 'compact' | 'detailed'
  // Comment specific
  commentTitle?: string
  commentRequireName?: boolean
  commentRequireEmail?: boolean
  commentModerated?: boolean       // If true, comments need approval
  commentMaxLength?: number
  commentTheme?: string            // Preset theme key
  // Poll specific
  pollQuestion?: string
  pollOptions?: string[]
  pollAllowMultiple?: boolean
  pollShowResultsBeforeVote?: boolean
  // Tracker specific
  trackerKitId?: string           // Which kit this tracker belongs to
  trackerConfigId?: string        // Maps to TrackerConfig.id (e.g. 'forty-yard')
  trackerTitle?: string           // Display title override
  trackerColor?: string           // Chart color override
  trackerChartType?: 'line' | 'bar'
  trackerShowSummary?: boolean    // Show summary cards above chart
  trackerTimeRange?: '7d' | '30d' | '90d' | '1y' | 'all'
  // Kit Profile specific
  kitProfileKitId?: string
  kitProfileData?: Record<string, any>
  kitProfileLayout?: 'card' | 'full'
  // Game Schedule specific
  gameScheduleTitle?: string
  gameScheduleGames?: {
    date: string
    opponent: string
    location: string
    homeAway: 'Home' | 'Away' | 'Neutral'
    time: string
    result?: string
  }[]
  gameScheduleShowPastGames?: boolean
  // Workout Schedule specific
  workoutScheduleTitle?: string
  workoutScheduleDays?: {
    day: string
    workouts: { name: string; setsReps?: string; notes?: string }[]
  }[]
  // Meal Prep specific
  mealPrepTitle?: string
  mealPrepMeals?: {
    mealType: string
    days: { day: string; name: string; notes?: string; macros?: string }[]
  }[]
  mealPrepShowMacros?: boolean
  // Jersey specific
  jerseyNumber?: string
  jerseyName?: string
  jerseyPrimaryColor?: string
  jerseySecondaryColor?: string
  jerseyStyle?: 'classic' | 'modern' | 'retro'
  jerseySignaturesEnabled?: boolean
  // Experience Entry specific
  expCompany?: string
  expTitle?: string
  expLocation?: string
  expStartDate?: string
  expEndDate?: string
  expCurrent?: boolean
  expDescription?: string
  expCompanyLogo?: string
  // Education Entry specific
  eduInstitution?: string
  eduDegree?: string
  eduField?: string
  eduGpa?: string
  eduStartDate?: string
  eduEndDate?: string
  eduHonors?: string
  eduDescription?: string
  // Skill Bar specific
  skillName?: string
  skillProficiency?: number
  skillCategory?: string
  // Certification Badge specific
  certName?: string
  certIssuer?: string
  certDateObtained?: string
  certExpirationDate?: string
  certCredentialId?: string
  certCredentialUrl?: string
  // Wedding Timeline specific
  weddingTimelineTitle?: string
  weddingTimelineEvents?: {
    time: string
    title: string
    description?: string
    icon?: string
  }[]
  // Wedding Party specific
  weddingPartyTitle?: string
  weddingPartyMembers?: {
    name: string
    role: string
    group: 'bride' | 'groom' | 'shared'
    photo?: string
  }[]
  // Wedding RSVP specific
  weddingRsvpTitle?: string
  weddingRsvpDeadline?: string
  weddingRsvpFields?: {
    attending: boolean
    plusOne: boolean
    mealOptions: string[]
    dietaryField: boolean
    songRequest: boolean
  }
  // Wedding Stats specific
  weddingStatsItems?: {
    label: string
    value: string
    icon?: string
  }[]
  // Wedding Registry specific
  weddingRegistryTitle?: string
  weddingRegistryItems?: {
    name: string
    url: string
    type: 'amazon' | 'target' | 'honeymoon' | 'custom'
    description?: string
  }[]
  // Wedding Hashtags specific
  weddingHashtags?: string[]
  // Text styling (text, heading, quote, callout, list)
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  fontStyle?: 'normal' | 'italic'
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  textColor?: string
  letterSpacing?: number
  lineHeight?: number
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
}

// Column settings for styling
export interface ColumnSettings {
  background: 'transparent' | 'translucent' | 'solid'
  backgroundColor: string
  borderVisible: boolean
  borderColor: string
  borderRadius: number
  padding: number
}

// Column structure
export interface Column {
  id: string
  elements: CanvasElement[]
  settings?: ColumnSettings
}

// Section structure
export interface Section {
  id: string
  layout: LayoutMode
  columns: Column[]
}

// Default column settings
export const DEFAULT_COLUMN_SETTINGS: ColumnSettings = {
  background: 'transparent',
  backgroundColor: '#ffffff',
  borderVisible: false,
  borderColor: '#e2e8f0',
  borderRadius: 8,
  padding: 16,
}

// Helper to create a new section
export function createSection(layout: LayoutMode): Section {
  const columnCount = layout === 'full-width' ? 1 : layout === 'two-column' ? 2 : 3
  const columns: Column[] = []

  for (let i = 0; i < columnCount; i++) {
    columns.push({
      id: `col-${Date.now()}-${i}`,
      elements: [],
    })
  }

  return {
    id: `section-${Date.now()}`,
    layout,
    columns,
  }
}

// Helper to create a new element with defaults
export function createElement(type: ElementType): CanvasElement {
  const base: CanvasElement = {
    id: `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
  }

  switch (type) {
    case 'text':
      return { ...base, content: '' }
    case 'heading':
      return { ...base, content: '', level: 2 }
    case 'image':
      return { ...base, url: '', alt: '', caption: '' }
    case 'embed':
      return { ...base, embedUrl: '', embedType: 'youtube' }
    case 'button':
      return {
        ...base,
        buttonText: 'Click me',
        buttonUrl: '',
        buttonVariant: 'solid',
        buttonColor: 'blue',
        buttonAlign: 'left',
      }
    case 'list':
      return { ...base, listType: 'bulleted', listTitle: '', listColumns: 1, items: [''] }
    case 'quote':
      return { ...base, quoteText: '', quoteAuthor: '' }
    case 'kpi':
      return {
        ...base,
        kpiLabel: 'Metric',
        kpiValue: '0',
        kpiPrefix: '',
        kpiSuffix: '',
        kpiTrend: 'neutral',
        kpiTrendValue: '',
        kpiColor: 'blue',
      }
    case 'table':
      return {
        ...base,
        tableHeaders: ['Column 1', 'Column 2', 'Column 3'],
        tableRows: [['', '', '']],
      }
    case 'callout':
      return {
        ...base,
        calloutType: 'info',
        calloutTitle: '',
        calloutContent: '',
      }
    case 'toggle':
      return {
        ...base,
        toggleTitle: 'Click to expand',
        toggleContent: '',
        toggleOpen: false,
      }
    case 'mcq':
      return {
        ...base,
        mcqQuestion: 'Your question here',
        mcqOptions: ['Option 1', 'Option 2', 'Option 3'],
        mcqAllowMultiple: false,
        mcqRequired: false,
      }
    case 'rating':
      return {
        ...base,
        ratingQuestion: 'How would you rate this?',
        ratingMax: 5,
        ratingStyle: 'stars',
        ratingRequired: false,
      }
    case 'shortanswer':
      return {
        ...base,
        shortAnswerQuestion: 'Your question here',
        shortAnswerPlaceholder: 'Type your answer...',
        shortAnswerRequired: false,
        shortAnswerMaxLength: 500,
      }
    case 'chart':
      return {
        ...base,
        chartType: 'bar',
        chartTitle: 'Chart Title',
        chartData: [
          { label: 'Jan', value: 30, color: '#3b82f6' },
          { label: 'Feb', value: 45, color: '#10b981' },
          { label: 'Mar', value: 35, color: '#f59e0b' },
          { label: 'Apr', value: 55, color: '#ef4444' },
          { label: 'May', value: 40, color: '#8b5cf6' },
        ],
        chartMultiLineData: {
          labels: ['Q1', 'Q2', 'Q3', 'Q4'],
          series: [
            { name: 'Product A', color: '#3b82f6', values: [20, 45, 35, 80] },
            { name: 'Product B', color: '#ef4444', values: [30, 25, 55, 65] },
          ],
          yAxisLabels: ['0', '25', '50', '75', '100'],
        },
        chartEnable3D: true,
        chartEnableGlow: true,
        chartEnableGradient: true,
        chartShowValues: true,
        chartShowLegend: true,
        chartShowGrid: true,
        chartNodeSize: 8,
      }
    case 'code':
      return {
        ...base,
        codeContent: '// Write your code here\nconsole.log("Hello, world!");',
        codeLanguage: 'javascript',
        codeTheme: 'dark',
        codeShowLineNumbers: true,
        codeFilename: '',
      }
    case 'card':
      return {
        ...base,
        cardProvider: 'vouch',
        cardData: {},
        cardStyle: 'default' as const,
      }
    case 'comment':
      return {
        ...base,
        commentTitle: 'Comments',
        commentRequireName: true,
        commentRequireEmail: false,
        commentModerated: false,
        commentMaxLength: 1000,
        commentTheme: 'minimal',
      }
    case 'poll':
      return {
        ...base,
        pollQuestion: 'What do you think?',
        pollOptions: ['Option 1', 'Option 2', 'Option 3'],
        pollAllowMultiple: false,
        pollShowResultsBeforeVote: false,
      }
    case 'tracker':
      return {
        ...base,
        trackerKitId: '',
        trackerConfigId: '',
        trackerTitle: 'Tracker',
        trackerColor: '#39D98A',
        trackerChartType: 'line',
        trackerShowSummary: true,
        trackerTimeRange: 'all',
      }
    case 'kit-profile':
      return {
        ...base,
        kitProfileKitId: '',
        kitProfileData: {},
        kitProfileLayout: 'card',
      }
    case 'game-schedule':
      return {
        ...base,
        gameScheduleTitle: 'Game Schedule',
        gameScheduleGames: [
          { date: '', opponent: '', location: '', homeAway: 'Home' as const, time: '' },
        ],
        gameScheduleShowPastGames: true,
      }
    case 'workout-schedule':
      return {
        ...base,
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
      }
    case 'meal-prep': {
      const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
      return {
        ...base,
        mealPrepTitle: 'Meal Prep',
        mealPrepMeals: MEALS.map(mealType => ({
          mealType,
          days: DAYS.map(day => ({ day, name: '', notes: '', macros: '' })),
        })),
        mealPrepShowMacros: false,
      }
    }
    case 'jersey':
      return {
        ...base,
        jerseyNumber: '1',
        jerseyName: 'PLAYER',
        jerseyPrimaryColor: '#39D98A',
        jerseySecondaryColor: '#0F3D2E',
        jerseyStyle: 'classic',
        jerseySignaturesEnabled: true,
      }
    case 'experience-entry':
      return {
        ...base,
        expCompany: '',
        expTitle: '',
        expLocation: '',
        expStartDate: '',
        expEndDate: '',
        expCurrent: false,
        expDescription: '',
        expCompanyLogo: '',
      }
    case 'education-entry':
      return {
        ...base,
        eduInstitution: '',
        eduDegree: '',
        eduField: '',
        eduGpa: '',
        eduStartDate: '',
        eduEndDate: '',
        eduHonors: '',
        eduDescription: '',
      }
    case 'skill-bar':
      return {
        ...base,
        skillName: '',
        skillProficiency: 75,
        skillCategory: '',
      }
    case 'certification-badge':
      return {
        ...base,
        certName: '',
        certIssuer: '',
        certDateObtained: '',
        certExpirationDate: '',
        certCredentialId: '',
        certCredentialUrl: '',
      }
    case 'wedding-timeline':
      return {
        ...base,
        weddingTimelineTitle: 'Our Wedding Day',
        weddingTimelineEvents: [
          { time: '4:00 PM', title: 'Ceremony', description: 'Exchange of vows', icon: 'Church' },
          { time: '4:45 PM', title: 'Cocktail Hour', description: 'Drinks & appetizers', icon: 'Wine' },
          { time: '6:00 PM', title: 'Reception', description: 'Dinner & toasts', icon: 'UtensilsCrossed' },
          { time: '7:30 PM', title: 'First Dance', description: 'Hit the dance floor', icon: 'Music' },
          { time: '10:00 PM', title: 'Send Off', description: 'Farewell celebration', icon: 'Sparkles' },
        ],
      }
    case 'wedding-party':
      return {
        ...base,
        weddingPartyTitle: 'Wedding Party',
        weddingPartyMembers: [],
      }
    case 'wedding-rsvp':
      return {
        ...base,
        weddingRsvpTitle: 'RSVP',
        weddingRsvpDeadline: '',
        weddingRsvpFields: {
          attending: true,
          plusOne: true,
          mealOptions: ['Chicken', 'Beef', 'Fish', 'Vegetarian'],
          dietaryField: true,
          songRequest: true,
        },
      }
    case 'wedding-stats':
      return {
        ...base,
        weddingStatsItems: [
          { label: 'Days Together', value: '544', icon: 'Heart' },
          { label: 'Cakes Tasted', value: '7', icon: 'Cake' },
          { label: 'Venues Visited', value: '12', icon: 'MapPin' },
          { label: 'Days Until "I Do"', value: '30', icon: 'Calendar' },
        ],
      }
    case 'wedding-registry':
      return {
        ...base,
        weddingRegistryTitle: 'Our Registry',
        weddingRegistryItems: [],
      }
    case 'wedding-hashtags':
      return {
        ...base,
        weddingHashtags: ['#ForeverUs', '#OurBigDay'],
      }
    default:
      return base
  }
}
