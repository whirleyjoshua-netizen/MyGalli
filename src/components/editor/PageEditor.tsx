'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, Image as ImageIcon, Save, Check, Share2, CreditCard, LayoutList, Users, AlignVerticalSpaceAround } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { ColumnCanvas } from '@/components/canvas/ColumnCanvas'
import { SlashCommandMenu } from '@/components/canvas/SlashCommandMenu'
import { BackgroundSettings } from '@/components/canvas/BackgroundSettings'
import { ColumnStyleSettings } from '@/components/canvas/ColumnStyleSettings'
import { SpacingSettings } from '@/components/canvas/SpacingSettings'
import { ShareDialog } from '@/components/editor/ShareDialog'
import { CollaborateModal } from '@/components/editor/CollaborateModal'
import { PresenceBar } from '@/components/editor/PresenceBar'
import { PublishDialog } from '@/components/editor/PublishDialog'
import { CardLibraryPicker } from '@/components/editor/CardLibraryPicker'
import { HeaderCard } from '@/components/header/HeaderCard'
import { HeaderCardEditor } from '@/components/header/HeaderCardEditor'
import { TabBar } from '@/components/tabs/TabBar'
import { TabEditor } from '@/components/tabs/TabEditor'
import type { Section, LayoutMode, ElementType, CanvasElement, ColumnSettings } from '@/lib/types/canvas'
import { DEFAULT_COLUMN_SETTINGS } from '@/lib/types/canvas'
import type { BackgroundConfig } from '@/lib/types/background'
import { DEFAULT_BACKGROUND_CONFIG, getBackgroundStyles } from '@/lib/types/background'
import type { SpacingConfig } from '@/lib/types/spacing'
import { DEFAULT_SPACING_CONFIG } from '@/lib/types/spacing'
import type { HeaderCardConfig } from '@/lib/types/header-card'
import { DEFAULT_HEADER_CARD } from '@/lib/types/header-card'
import type { TabsConfig } from '@/lib/types/tabs'
import { DEFAULT_TABS_CONFIG, createTab } from '@/lib/types/tabs'
import type { KitPageConfig } from '@/lib/types/kit'
import { KitBanner } from '@/components/kits/KitBanner'
import { loadGoogleFont } from '@/lib/fonts'
import { isPro } from '@/lib/plan'
import { UpgradePrompt } from '@/components/pro/UpgradePrompt'

interface PageEditorProps {
  pageId?: string
}

export function PageEditor({ pageId }: PageEditorProps) {
  const router = useRouter()
  const { user } = useAuthStore()

  // Page state
  const [id, setId] = useState<string | null>(pageId || null)
  const [title, setTitle] = useState('Untitled Page')
  const [slug, setSlug] = useState('')
  const [published, setPublished] = useState(false)
  const [sections, setSections] = useState<Section[]>([])
  const [background, setBackground] = useState<BackgroundConfig>(DEFAULT_BACKGROUND_CONFIG)
  const [spacing, setSpacing] = useState<SpacingConfig>(DEFAULT_SPACING_CONFIG)
  const [headerCard, setHeaderCard] = useState<HeaderCardConfig>(DEFAULT_HEADER_CARD)
  const [tabsConfig, setTabsConfig] = useState<TabsConfig>(DEFAULT_TABS_CONFIG)
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [kitConfig, setKitConfig] = useState<KitPageConfig | null>(null)

  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false)
  const [showSpacingSettings, setShowSpacingSettings] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)

  // Slash menu state
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 })
  const [currentSection, setCurrentSection] = useState<string | null>(null)
  const [currentColumn, setCurrentColumn] = useState<string | null>(null)

  // Share dialog state
  const [showShareDialog, setShowShareDialog] = useState(false)

  // Collaboration state
  const [version, setVersion] = useState(0)
  const versionRef = useRef(0)
  const [isOwner, setIsOwner] = useState(true)
  const [conflict, setConflict] = useState(false)
  const [showCollaborate, setShowCollaborate] = useState(false)

  // Publish/category state
  const [category, setCategory] = useState<string | null>(null)
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [showPublishDialog, setShowPublishDialog] = useState(false)

  // Header card & tab editor state
  const [showHeaderEditor, setShowHeaderEditor] = useState(false)
  const [showTabEditor, setShowTabEditor] = useState(false)

  // Card picker state
  const [cardPickerOpen, setCardPickerOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  // Column settings state
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [editingColumnSection, setEditingColumnSection] = useState<string | null>(null)
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)

  // Load or create page
  useEffect(() => {
    if (pageId) {
      loadPage(pageId)
    } else {
      createNewPage()
    }
  }, [pageId])

  // Active sections abstraction — routes to tabs when enabled
  const getActiveSections = useCallback((): Section[] => {
    if (!tabsConfig.enabled || tabsConfig.tabs.length === 0) return sections
    const tab = tabsConfig.tabs.find(t => t.id === activeTabId) || tabsConfig.tabs[0]
    return tab?.sections || []
  }, [tabsConfig, activeTabId, sections])

  const setActiveSections = useCallback((updater: Section[] | ((prev: Section[]) => Section[])) => {
    if (!tabsConfig.enabled || tabsConfig.tabs.length === 0) {
      setSections(updater)
      return
    }
    const targetId = activeTabId || tabsConfig.tabs[0]?.id
    setTabsConfig(prev => ({
      ...prev,
      tabs: prev.tabs.map(tab =>
        tab.id === targetId
          ? { ...tab, sections: typeof updater === 'function' ? updater(tab.sections) : updater }
          : tab
      ),
    }))
  }, [tabsConfig.enabled, tabsConfig.tabs, activeTabId])

  // Active header card abstraction — per-tab when tabs enabled
  const getActiveHeaderCard = useCallback((): HeaderCardConfig => {
    if (!tabsConfig.enabled || tabsConfig.tabs.length === 0) return headerCard
    const tab = tabsConfig.tabs.find(t => t.id === activeTabId) || tabsConfig.tabs[0]
    return tab?.headerCard ?? headerCard
  }, [tabsConfig, activeTabId, headerCard])

  const setActiveHeaderCard = useCallback((config: HeaderCardConfig) => {
    if (!tabsConfig.enabled || tabsConfig.tabs.length === 0) {
      setHeaderCard(config)
      return
    }
    const targetId = activeTabId || tabsConfig.tabs[0]?.id
    setTabsConfig(prev => ({
      ...prev,
      tabs: prev.tabs.map(tab =>
        tab.id === targetId ? { ...tab, headerCard: config } : tab
      ),
    }))
  }, [tabsConfig.enabled, tabsConfig.tabs, activeTabId])

  // Active background abstraction — per-tab when tabs enabled
  const getActiveBackground = useCallback((): BackgroundConfig => {
    if (!tabsConfig.enabled || tabsConfig.tabs.length === 0) return background
    const tab = tabsConfig.tabs.find(t => t.id === activeTabId) || tabsConfig.tabs[0]
    return tab?.background ?? DEFAULT_BACKGROUND_CONFIG
  }, [tabsConfig, activeTabId, background])

  const setActiveBackground = useCallback((config: BackgroundConfig) => {
    if (!tabsConfig.enabled || tabsConfig.tabs.length === 0) {
      setBackground(config)
      return
    }
    const targetId = activeTabId || tabsConfig.tabs[0]?.id
    setTabsConfig(prev => ({
      ...prev,
      tabs: prev.tabs.map(tab =>
        tab.id === targetId ? { ...tab, background: config } : tab
      ),
    }))
  }, [tabsConfig.enabled, tabsConfig.tabs, activeTabId])

  // Load custom fonts used by elements
  useEffect(() => {
    const fonts = new Set<string>()
    const scanSections = (sects: Section[]) => {
      for (const section of sects) {
        for (const column of section.columns) {
          for (const element of column.elements) {
            if (element.fontFamily) fonts.add(element.fontFamily)
          }
        }
      }
    }
    scanSections(sections)
    if (tabsConfig.enabled) {
      for (const tab of tabsConfig.tabs) {
        scanSections(tab.sections)
      }
    }
    fonts.forEach((family) => loadGoogleFont(family))
  }, [sections, tabsConfig])

  // Auto-save every 5 seconds
  useEffect(() => {
    if (!id) return

    const interval = setInterval(() => {
      savePage()
    }, 5000)

    return () => clearInterval(interval)
  }, [id, sections, background, spacing, title, headerCard, tabsConfig])

  const loadPage = async (pid: string) => {
    try {
      const res = await fetch(`/api/displays/${pid}`)

      if (res.ok) {
        const data = await res.json()
        setId(data.id)
        setTitle(data.title)
        setSlug(data.slug)
        setPublished(data.published)
        setCategory(data.category ?? null)
        setCoverImage(data.coverImage ?? null)
        setVersion(typeof data.version === 'number' ? data.version : 0)
        versionRef.current = typeof data.version === 'number' ? data.version : 0
        setIsOwner(data.isOwner !== false)

        // Parse sections
        const loadedSections = typeof data.sections === 'string'
          ? JSON.parse(data.sections)
          : data.sections || []

        // If no sections, initialize with one
        if (loadedSections.length === 0) {
          setSections([createInitialSection()])
        } else {
          setSections(loadedSections)
        }

        // Parse background
        const loadedBackground = typeof data.background === 'string'
          ? JSON.parse(data.background)
          : data.background || DEFAULT_BACKGROUND_CONFIG

        setBackground(loadedBackground)

        // Parse spacing (null on legacy pages → defaults)
        const loadedSpacing = data.spacing
          ? (typeof data.spacing === 'string' ? JSON.parse(data.spacing) : data.spacing)
          : DEFAULT_SPACING_CONFIG
        setSpacing({ ...DEFAULT_SPACING_CONFIG, ...loadedSpacing })

        // Parse header card
        const loadedHeaderCard = data.headerCard
          ? (typeof data.headerCard === 'string' ? JSON.parse(data.headerCard) : data.headerCard)
          : DEFAULT_HEADER_CARD
        setHeaderCard(loadedHeaderCard)

        // Parse tabs
        const loadedTabs = data.tabs
          ? (typeof data.tabs === 'string' ? JSON.parse(data.tabs) : data.tabs)
          : DEFAULT_TABS_CONFIG
        setTabsConfig(loadedTabs)
        if (loadedTabs.enabled && loadedTabs.tabs.length > 0) {
          setActiveTabId(loadedTabs.tabs[0].id)
        }

        // Parse kit config
        const loadedKitConfig = data.kitConfig
          ? (typeof data.kitConfig === 'string' ? JSON.parse(data.kitConfig) : data.kitConfig)
          : null
        setKitConfig(loadedKitConfig)
      } else if (res.status === 403 || res.status === 404) {
        // No access to this page (not owner/collaborator) — back to dashboard
        router.push('/dashboard')
        return
      } else {
        // Unexpected error, create new
        createNewPage()
      }
    } catch (error) {
      console.error('Error loading page:', error)
      createNewPage()
    } finally {
      setLoading(false)
    }
  }

  const createNewPage = async () => {
    try {
      const res = await fetch('/api/displays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled Page' }),
      })

      if (res.ok) {
        const data = await res.json()
        setId(data.id)
        setTitle(data.title)
        setSlug(data.slug)
        setPublished(false)

        // Initialize with one section
        const initialSection = createInitialSection()
        setSections([initialSection])

        // Update URL without reload
        window.history.replaceState({}, '', `/editor?id=${data.id}`)
      }
    } catch (error) {
      console.error('Error creating page:', error)
    } finally {
      setLoading(false)
    }
  }

  const createInitialSection = (): Section => ({
    id: `section-${Date.now()}`,
    layout: 'full-width',
    columns: [{ id: `col-${Date.now()}`, elements: [] }],
  })

  const savePage = useCallback(async () => {
    if (!id || saving || conflict) return

    setSaving(true)
    try {
      // When tabs are enabled, keep top-level sections synced with first tab for backward compat
      const sectionsToSave = tabsConfig.enabled && tabsConfig.tabs.length > 0
        ? tabsConfig.tabs[0].sections
        : sections

      const res = await fetch(`/api/displays/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // title is owner-only; collaborators omit it to avoid a 403
          ...(isOwner ? { title } : {}),
          sections: sectionsToSave,
          background,
          spacing,
          headerCard: headerCard.enabled ? headerCard : null,
          tabs: tabsConfig.enabled ? tabsConfig : null,
          version: versionRef.current,
        }),
      })
      if (res.status === 409) {
        setConflict(true)
        return
      }
      if (res.ok) {
        const updated = await res.json()
        if (typeof updated.version === 'number') {
          versionRef.current = updated.version
          setVersion(updated.version)
        }
        setLastSaved(new Date())
      }
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setSaving(false)
    }
  }, [id, title, sections, background, spacing, headerCard, tabsConfig, saving, conflict, isOwner])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        savePage()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [savePage])

  // Section operations
  const addSection = (layout: LayoutMode) => {
    const columnCount = layout === 'full-width' ? 1 : layout === 'two-column' ? 2 : 3
    const columns = Array.from({ length: columnCount }, (_, i) => ({
      id: `col-${Date.now()}-${i}`,
      elements: [],
    }))

    setActiveSections((prev) => [
      ...prev,
      { id: `section-${Date.now()}`, layout, columns },
    ])
  }

  const deleteSection = (sectionId: string) => {
    setActiveSections((prev) => prev.filter((s) => s.id !== sectionId))
  }

  // Slash menu
  const openSlashMenu = (sectionId: string, columnId: string, position?: { x: number; y: number }) => {
    setCurrentSection(sectionId)
    setCurrentColumn(columnId)
    setSlashMenuPosition(position || { x: window.innerWidth / 2 - 160, y: 200 })
    setShowSlashMenu(true)
  }

  const handleCommandSelect = (type: ElementType) => {
    if (!currentSection || !currentColumn) return

    const newElement: CanvasElement = {
      id: `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
    }

    // Set defaults based on type
    switch (type) {
      case 'text':
        newElement.content = ''
        break
      case 'heading':
        newElement.content = ''
        newElement.level = 2
        break
      case 'image':
        newElement.url = ''
        newElement.alt = ''
        break
      case 'embed':
        newElement.embedUrl = ''
        newElement.embedType = 'youtube'
        break
      case 'button':
        newElement.buttonText = 'Click me'
        newElement.buttonUrl = ''
        newElement.buttonVariant = 'solid'
        newElement.buttonColor = 'blue'
        newElement.buttonAlign = 'left'
        break
      case 'list':
        newElement.listType = 'bulleted'
        newElement.listTitle = ''
        newElement.listColumns = 1
        newElement.items = ['']
        break
      case 'quote':
        newElement.quoteText = ''
        newElement.quoteAuthor = ''
        break
      case 'kpi':
        newElement.kpiLabel = 'Metric'
        newElement.kpiValue = '0'
        newElement.kpiPrefix = ''
        newElement.kpiSuffix = ''
        newElement.kpiTrend = 'neutral'
        newElement.kpiTrendValue = ''
        newElement.kpiColor = 'blue'
        break
      case 'table':
        newElement.tableHeaders = ['Column 1', 'Column 2', 'Column 3']
        newElement.tableRows = [['', '', '']]
        break
      case 'callout':
        newElement.calloutType = 'info'
        newElement.calloutTitle = ''
        newElement.calloutContent = ''
        break
      case 'toggle':
        newElement.toggleTitle = 'Click to expand'
        newElement.toggleContent = ''
        newElement.toggleOpen = false
        break
      case 'mcq':
        newElement.mcqQuestion = 'Your question here'
        newElement.mcqOptions = ['Option 1', 'Option 2', 'Option 3']
        newElement.mcqAllowMultiple = false
        newElement.mcqRequired = false
        break
      case 'rating':
        newElement.ratingQuestion = 'How would you rate this?'
        newElement.ratingMax = 5
        newElement.ratingStyle = 'stars'
        newElement.ratingRequired = false
        break
      case 'shortanswer':
        newElement.shortAnswerQuestion = 'Your question here'
        newElement.shortAnswerPlaceholder = 'Type your answer...'
        newElement.shortAnswerRequired = false
        newElement.shortAnswerMaxLength = 500
        break
      case 'code':
        newElement.codeContent = '// Write your code here\nconsole.log("Hello, world!");'
        newElement.codeLanguage = 'javascript'
        newElement.codeTheme = 'dark'
        newElement.codeShowLineNumbers = true
        newElement.codeFilename = ''
        break
      case 'slideshow':
        newElement.slideshowSlides = [{ imageUrl: '', title: '', description: '' }]
        newElement.slideshowHeight = 400
        newElement.slideshowShowOverlay = true
        break
      case 'card': {
        // Library Apps are a Pro feature; gate the insert.
        setShowSlashMenu(false)
        if (!isPro(user)) {
          setUpgradeOpen(true)
          return
        }
        setCardPickerOpen(true)
        return
      }
      case 'comment':
        newElement.commentTitle = 'Comments'
        newElement.commentRequireName = true
        newElement.commentRequireEmail = false
        newElement.commentModerated = false
        newElement.commentMaxLength = 1000
        newElement.commentTheme = 'minimal'
        break
      case 'poll':
        newElement.pollQuestion = 'What do you think?'
        newElement.pollOptions = ['Option 1', 'Option 2', 'Option 3']
        newElement.pollAllowMultiple = false
        newElement.pollShowResultsBeforeVote = false
        break
      case 'tracker':
        newElement.trackerKitId = ''
        newElement.trackerConfigId = ''
        newElement.trackerTitle = 'Tracker'
        newElement.trackerColor = '#39D98A'
        newElement.trackerChartType = 'line'
        newElement.trackerShowSummary = true
        newElement.trackerTimeRange = 'all'
        break
      case 'kit-profile':
        newElement.kitProfileKitId = ''
        newElement.kitProfileData = {}
        newElement.kitProfileLayout = 'card'
        break
      case 'game-schedule':
        newElement.gameScheduleTitle = 'Game Schedule'
        newElement.gameScheduleGames = [
          { date: '', opponent: '', location: '', homeAway: 'Home' as const, time: '' },
        ]
        newElement.gameScheduleShowPastGames = true
        break
      case 'workout-schedule':
        newElement.workoutScheduleTitle = 'Weekly Workouts'
        newElement.workoutScheduleDays = [
          { day: 'Mon', workouts: [] },
          { day: 'Tue', workouts: [] },
          { day: 'Wed', workouts: [] },
          { day: 'Thu', workouts: [] },
          { day: 'Fri', workouts: [] },
          { day: 'Sat', workouts: [] },
          { day: 'Sun', workouts: [] },
        ]
        break
      case 'meal-prep': {
        const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
        newElement.mealPrepTitle = 'Meal Prep'
        newElement.mealPrepMeals = MEALS.map(mealType => ({
          mealType,
          days: DAYS.map(day => ({ day, name: '', notes: '', macros: '' })),
        }))
        newElement.mealPrepShowMacros = false
        break
      }
      case 'jersey':
        newElement.jerseyNumber = '1'
        newElement.jerseyName = 'PLAYER'
        newElement.jerseyPrimaryColor = '#39D98A'
        newElement.jerseySecondaryColor = '#0F3D2E'
        newElement.jerseyStyle = 'classic'
        newElement.jerseySignaturesEnabled = true
        break
      case 'experience-entry':
        newElement.expCompany = ''
        newElement.expTitle = ''
        newElement.expLocation = ''
        newElement.expStartDate = ''
        newElement.expEndDate = ''
        newElement.expCurrent = false
        newElement.expDescription = ''
        break
      case 'education-entry':
        newElement.eduInstitution = ''
        newElement.eduDegree = ''
        newElement.eduField = ''
        newElement.eduGpa = ''
        newElement.eduStartDate = ''
        newElement.eduEndDate = ''
        newElement.eduHonors = ''
        newElement.eduDescription = ''
        break
      case 'skill-bar':
        newElement.skillName = ''
        newElement.skillProficiency = 75
        newElement.skillCategory = ''
        break
      case 'certification-badge':
        newElement.certName = ''
        newElement.certIssuer = ''
        newElement.certDateObtained = ''
        newElement.certExpirationDate = ''
        newElement.certCredentialId = ''
        newElement.certCredentialUrl = ''
        break
      case 'wedding-timeline':
        newElement.weddingTimelineTitle = 'Our Wedding Day'
        newElement.weddingTimelineEvents = [
          { time: '4:00 PM', title: 'Ceremony', description: 'Exchange of vows', icon: 'Church' },
          { time: '4:45 PM', title: 'Cocktail Hour', description: 'Drinks & appetizers', icon: 'Wine' },
          { time: '6:00 PM', title: 'Reception', description: 'Dinner & toasts', icon: 'UtensilsCrossed' },
          { time: '7:30 PM', title: 'First Dance', description: 'Hit the dance floor', icon: 'Music' },
          { time: '10:00 PM', title: 'Send Off', description: 'Farewell celebration', icon: 'Sparkles' },
        ]
        break
      case 'wedding-party':
        newElement.weddingPartyTitle = 'Wedding Party'
        newElement.weddingPartyMembers = []
        break
      case 'wedding-rsvp':
        newElement.weddingRsvpTitle = 'RSVP'
        newElement.weddingRsvpDeadline = ''
        newElement.weddingRsvpFields = {
          attending: true,
          plusOne: true,
          mealOptions: ['Chicken', 'Beef', 'Fish', 'Vegetarian'],
          dietaryField: true,
          songRequest: true,
        }
        break
      case 'wedding-stats':
        newElement.weddingStatsItems = [
          { label: 'Days Together', value: '544', icon: 'Heart' },
          { label: 'Cakes Tasted', value: '7', icon: 'Cake' },
          { label: 'Venues Visited', value: '12', icon: 'MapPin' },
          { label: 'Days Until "I Do"', value: '30', icon: 'Calendar' },
        ]
        break
      case 'wedding-registry':
        newElement.weddingRegistryTitle = 'Our Registry'
        newElement.weddingRegistryItems = []
        break
      case 'wedding-hashtags':
        newElement.weddingHashtags = ['#ForeverUs', '#OurBigDay']
        break
      case 'mood-board':
        newElement.moodBoardTitle = 'Mood Board'
        newElement.moodBoardItems = []
        newElement.moodBoardColumns = 3
        break
      case 'color-palette':
        newElement.colorPaletteTitle = 'My Palette'
        newElement.colorPaletteColors = [
          { hex: '#FF6B6B', name: 'Coral' },
          { hex: '#4ECDC4', name: 'Teal' },
          { hex: '#45B7D1', name: 'Sky' },
          { hex: '#96CEB4', name: 'Sage' },
          { hex: '#FFEAA7', name: 'Sunshine' },
        ]
        break
      case 'playlist':
        newElement.playlistTitle = 'My Playlist'
        newElement.playlistItems = []
        break
      case 'quote-wall':
        newElement.quoteWallTitle = 'Words I Live By'
        newElement.quoteWallQuotes = [
          { text: 'Be yourself; everyone else is already taken.', author: 'Oscar Wilde', source: '' },
        ]
        break
      case 'timeline':
        newElement.timelineTitle = 'My Timeline'
        newElement.timelineColor = '#39D98A'
        newElement.timelineEvents = [
          { date: 'Jan 2025', title: 'Started the Journey', description: 'The beginning of something new', icon: 'Flag', isCurrent: false },
          { date: 'Jun 2025', title: 'Major Milestone', description: 'Reached a key goal', icon: 'Trophy', isCurrent: true },
          { date: 'Dec 2025', title: 'What\'s Next', description: 'Looking ahead to the future', icon: 'Rocket', isCurrent: false },
        ]
        break
      case 'course-list':
        newElement.courseListTitle = 'My Courses'
        newElement.courseListCourses = [
          { name: 'AP English Literature', code: 'ENG-401', grade: 'A', credits: '1.0', semester: 'Fall 2025', category: 'English' },
          { name: 'AP Calculus BC', code: 'MATH-402', grade: 'A-', credits: '1.0', semester: 'Fall 2025', category: 'Math' },
          { name: 'AP Biology', code: 'SCI-401', grade: 'A', credits: '1.0', semester: 'Fall 2025', category: 'Science' },
        ]
        newElement.courseListShowGPA = true
        break
      case 'gpa-card':
        newElement.gpaValue = ''
        newElement.gpaScale = '4.0'
        newElement.gpaWeighted = false
        newElement.gpaLabel = 'Cumulative GPA'
        newElement.gpaTrend = ''
        newElement.gpaHonors = ''
        break
      case 'test-scores':
        newElement.testScoresTitle = 'Test Scores'
        newElement.testScoresEntries = [
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
        ]
        break
      case 'awards-showcase':
        newElement.awardsShowcaseTitle = 'Awards & Honors'
        newElement.awardsShowcaseItems = [
          { title: 'Honor Roll', issuer: 'School Name', date: '2025', description: 'Maintained GPA above 3.5', icon: 'Award' },
          { title: 'National Merit Semifinalist', issuer: 'National Merit Scholarship Program', date: '2025', description: '', icon: 'Star' },
        ]
        break
      case 'social-stats':
        newElement.socialStatsTitle = 'Social Media'
        newElement.socialStatsPlatforms = [
          { platform: 'instagram', handle: '@yourhandle', followers: '0', url: '' },
        ]
        break
      case 'collab-card':
        newElement.collabTitle = 'Brand Collaborations'
        newElement.collabItems = [
          { brand: 'Brand Name', role: 'Sponsored Post', dateRange: '', description: '', image: '', link: '' },
        ]
        break
      case 'rate-card':
        newElement.rateCardTitle = 'Packages & Rates'
        newElement.rateCardPackages = [
          { name: 'Basic', description: 'Single post', deliverables: ['1 Feed Post', '2 Stories'], price: '$500', highlight: false },
          { name: 'Standard', description: 'Multi-platform', deliverables: ['1 Feed Post', '1 Reel/TikTok', '3 Stories'], price: '$1,200', highlight: true },
          { name: 'Premium', description: 'Full campaign', deliverables: ['2 Feed Posts', '2 Reels', '5 Stories', 'Blog Feature'], price: '$3,000', highlight: false },
        ]
        break
      case 'media-kit-stats':
        newElement.mediaKitTitle = 'Audience Demographics'
        newElement.mediaKitStats = [
          { label: 'Age Range', items: [{ name: '18–24', value: '35%' }, { name: '25–34', value: '45%' }, { name: '35+', value: '20%' }] },
          { label: 'Gender', items: [{ name: 'Female', value: '65%' }, { name: 'Male', value: '30%' }, { name: 'Other', value: '5%' }] },
        ]
        break
      case 'business-menu':
        newElement.bizMenuTitle = 'Our Menu'
        newElement.bizMenuCurrency = '$'
        newElement.bizMenuCategories = [
          { name: 'Main Dishes', items: [{ name: 'House Special', description: 'Our signature dish', price: '14.99', tags: ['popular'] }] },
        ]
        break
      case 'business-hours':
        newElement.bizHoursTitle = 'Hours & Location'
        newElement.bizHoursSchedule = [
          { day: 'Monday', open: '9:00 AM', close: '5:00 PM', closed: false },
          { day: 'Tuesday', open: '9:00 AM', close: '5:00 PM', closed: false },
          { day: 'Wednesday', open: '9:00 AM', close: '5:00 PM', closed: false },
          { day: 'Thursday', open: '9:00 AM', close: '5:00 PM', closed: false },
          { day: 'Friday', open: '9:00 AM', close: '5:00 PM', closed: false },
          { day: 'Saturday', open: '10:00 AM', close: '4:00 PM', closed: false },
          { day: 'Sunday', open: '', close: '', closed: true },
        ]
        break
      case 'business-review':
        newElement.bizReviewTitle = 'Customer Reviews'
        newElement.bizReviewCurated = []
        newElement.bizReviewAllowSubmissions = true
        break
      case 'business-promo':
        newElement.bizPromoTitle = 'Specials & Promotions'
        newElement.bizPromoItems = [
          { title: 'Grand Opening Special', description: 'Come check us out!', badge: 'NEW', ctaText: '', ctaUrl: '' },
        ]
        break
    }

    setActiveSections((prev) =>
      prev.map((section) =>
        section.id === currentSection
          ? {
              ...section,
              columns: section.columns.map((col) =>
                col.id === currentColumn
                  ? { ...col, elements: [...col.elements, newElement] }
                  : col
              ),
            }
          : section
      )
    )

    setShowSlashMenu(false)
    setCurrentSection(null)
    setCurrentColumn(null)
  }

  // Card picker selection handler
  const handleCardPickerSelect = (card: { provider: string; data: Record<string, any>; style: string }) => {
    if (!currentSection || !currentColumn) return

    const newElement: CanvasElement = {
      id: crypto.randomUUID(),
      type: 'card',
      content: '',
      cardProvider: card.provider,
      cardData: { ...card.data },
      cardStyle: (card.style || 'default') as 'default' | 'compact' | 'detailed',
    }

    setActiveSections((prev) =>
      prev.map((section) =>
        section.id === currentSection
          ? {
              ...section,
              columns: section.columns.map((col) =>
                col.id === currentColumn
                  ? { ...col, elements: [...col.elements, newElement] }
                  : col
              ),
            }
          : section
      )
    )

    setCardPickerOpen(false)
    setCurrentSection(null)
    setCurrentColumn(null)
  }

  // Element operations
  const updateElement = (
    sectionId: string,
    columnId: string,
    elementId: string,
    updates: Partial<CanvasElement>
  ) => {
    setActiveSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              columns: section.columns.map((col) =>
                col.id === columnId
                  ? {
                      ...col,
                      elements: col.elements.map((el) =>
                        el.id === elementId ? { ...el, ...updates } : el
                      ),
                    }
                  : col
              ),
            }
          : section
      )
    )
  }

  const deleteElement = (sectionId: string, columnId: string, elementId: string) => {
    setActiveSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              columns: section.columns.map((col) =>
                col.id === columnId
                  ? { ...col, elements: col.elements.filter((el) => el.id !== elementId) }
                  : col
              ),
            }
          : section
      )
    )
  }

  // Column settings
  const openColumnSettings = (sectionId: string, columnId: string) => {
    setEditingColumnSection(sectionId)
    setEditingColumnId(columnId)
    setShowColumnSettings(true)
  }

  const getCurrentColumnSettings = (): ColumnSettings => {
    if (!editingColumnSection || !editingColumnId) return DEFAULT_COLUMN_SETTINGS
    const activeSections = getActiveSections()
    const section = activeSections.find((s) => s.id === editingColumnSection)
    if (!section) return DEFAULT_COLUMN_SETTINGS
    const column = section.columns.find((c) => c.id === editingColumnId)
    return column?.settings || DEFAULT_COLUMN_SETTINGS
  }

  const updateColumnSettings = (settings: ColumnSettings) => {
    if (!editingColumnSection || !editingColumnId) return
    setActiveSections((prev) =>
      prev.map((section) =>
        section.id === editingColumnSection
          ? {
              ...section,
              columns: section.columns.map((col) =>
                col.id === editingColumnId
                  ? { ...col, settings }
                  : col
              ),
            }
          : section
      )
    )
  }

  // Publish
  const handlePublishToggle = async () => {
    if (!id) return
    if (!published) {
      // Going public requires choosing a category — open the publish dialog
      setShowPublishDialog(true)
      return
    }
    // Unpublish is a one-click toggle
    setPublished(false)
    await fetch(`/api/displays/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: false }),
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const pageUrl =
    typeof window !== 'undefined' && user?.username
      ? `${window.location.origin}/${user.username}/${slug}`
      : ''

  const activeHeaderCardConfig = getActiveHeaderCard()
  const activeBackgroundConfig = getActiveBackground()
  const backgroundStyles = getBackgroundStyles(activeBackgroundConfig)

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      {!isPreviewMode && (
        <header className="border-b border-border bg-background px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4 shrink-0">
            <Link
              href="/dashboard"
              className="p-2 hover:bg-muted rounded-lg transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={savePage}
              placeholder="Untitled Page"
              className="text-xl font-bold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1"
            />
          </div>

          <div className="flex flex-1 min-w-0 items-center flex-wrap justify-end gap-2">
            {/* Save Status */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {saving ? (
                <>
                  <Save className="w-4 h-4 animate-pulse" />
                  <span>Saving...</span>
                </>
              ) : lastSaved ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Saved</span>
                </>
              ) : null}
            </div>

            {/* Header Card */}
            <button
              onClick={() => setShowHeaderEditor(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition"
            >
              <CreditCard className="w-4 h-4" />
              Header
            </button>

            {/* Tabs */}
            <button
              onClick={() => setShowTabEditor(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition"
            >
              <LayoutList className="w-4 h-4" />
              Tabs
            </button>

            {/* Background */}
            <button
              onClick={() => setShowBackgroundSettings(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition"
            >
              <ImageIcon className="w-4 h-4" />
              Background
            </button>

            {/* Layout & Spacing */}
            <button
              onClick={() => setShowSpacingSettings(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition"
            >
              <AlignVerticalSpaceAround className="w-4 h-4" />
              Spacing
            </button>

            {/* Preview */}
            <button
              onClick={() => setIsPreviewMode(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>

            {/* View Live */}
            {published && user && (
              <Link
                href={`/${user.username}/${slug}`}
                target="_blank"
                className="px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition"
              >
                View Live
              </Link>
            )}

            {/* Presence (who's editing) */}
            {id && <PresenceBar displayId={id} />}

            {/* Collaborate */}
            {id && (
              <button
                onClick={() => setShowCollaborate(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition"
              >
                <Users className="w-4 h-4" />
                Collaborate
              </button>
            )}

            {/* Owner-only: Share + Publish */}
            {isOwner && (
              <>
                <button
                  onClick={() => setShowShareDialog(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted rounded-lg transition"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>

                <button
                  onClick={handlePublishToggle}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                    published
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-primary text-primary-foreground hover:opacity-90'
                  }`}
                >
                  {published ? 'Published' : 'Publish'}
                </button>
              </>
            )}
          </div>
        </header>
      )}

      {/* Conflict banner */}
      {conflict && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2.5 text-sm flex items-center justify-between flex-shrink-0">
          <span>This page was updated by another editor. Reload to get the latest — your unsaved changes will be lost.</span>
          <button onClick={() => window.location.reload()} className="ml-4 px-3 py-1 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition cursor-pointer">
            Reload
          </button>
        </div>
      )}

      {/* Kit Banner */}
      {!isPreviewMode && kitConfig && (
        <KitBanner kitId={kitConfig.kitId} />
      )}

      {/* Preview Mode Header */}
      {isPreviewMode && (
        <div className="border-b border-border bg-background px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h1 className="text-2xl font-bold">{title}</h1>
          <button
            onClick={() => setIsPreviewMode(false)}
            className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition"
          >
            <Eye className="w-4 h-4" />
            Exit Preview
          </button>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 overflow-auto flex flex-col">
        {/* Tab Bar — at the very top, above everything */}
        {tabsConfig.enabled && tabsConfig.tabs.length > 0 && (
          <div className="bg-background/90 backdrop-blur-sm sticky top-0 z-10 border-b border-border px-4 flex-shrink-0">
            <div className="max-w-6xl mx-auto">
              <TabBar
                tabs={tabsConfig.tabs}
                activeTabId={activeTabId || tabsConfig.tabs[0]?.id}
                onSelectTab={setActiveTabId}
                onAddTab={() => {
                  const newTab = createTab(`Tab ${tabsConfig.tabs.length + 1}`)
                  setTabsConfig(prev => ({ ...prev, tabs: [...prev.tabs, newTab] }))
                }}
                onRenameTab={(tabId, newLabel) => {
                  setTabsConfig(prev => ({
                    ...prev,
                    tabs: prev.tabs.map(t =>
                      t.id === tabId
                        ? { ...t, label: newLabel, slug: newLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
                        : t
                    ),
                  }))
                }}
                onDeleteTab={(tabId) => {
                  const remaining = tabsConfig.tabs.filter(t => t.id !== tabId)
                  if (remaining.length === 0) {
                    setTabsConfig({ ...DEFAULT_TABS_CONFIG })
                    setActiveTabId(null)
                  } else {
                    setTabsConfig(prev => ({ ...prev, tabs: remaining }))
                    if (activeTabId === tabId) setActiveTabId(remaining[0].id)
                  }
                }}
                onMoveTab={(tabId, direction) => {
                  const idx = tabsConfig.tabs.findIndex(t => t.id === tabId)
                  const newIdx = direction === 'left' ? idx - 1 : idx + 1
                  if (newIdx < 0 || newIdx >= tabsConfig.tabs.length) return
                  const newTabs = [...tabsConfig.tabs]
                  ;[newTabs[idx], newTabs[newIdx]] = [newTabs[newIdx], newTabs[idx]]
                  setTabsConfig(prev => ({ ...prev, tabs: newTabs }))
                }}
                isEditorMode={!isPreviewMode}
                style={tabsConfig.style}
                alignment={tabsConfig.alignment}
              />
            </div>
          </div>
        )}

        {/* Per-tab (or global) background + header + content */}
        <div className="flex-1" style={backgroundStyles}>
          {/* Header Card Preview */}
          {activeHeaderCardConfig.enabled && (
            <div
              className={`${!isPreviewMode ? 'cursor-pointer ring-transparent hover:ring-2 hover:ring-primary/30 transition-all' : ''}`}
              onClick={() => !isPreviewMode && setShowHeaderEditor(true)}
            >
              <HeaderCard config={activeHeaderCardConfig} />
            </div>
          )}

          <ColumnCanvas
            sections={getActiveSections()}
            onSectionsChange={setActiveSections}
            onAddSection={addSection}
            onDeleteSection={deleteSection}
            onOpenSlashMenu={openSlashMenu}
            onUpdateElement={updateElement}
            onDeleteElement={deleteElement}
            onOpenColumnSettings={openColumnSettings}
            isPreviewMode={isPreviewMode}
            displayId={id || undefined}
            spacing={spacing}
          />
        </div>
      </div>

      {/* Slash Menu */}
      {showSlashMenu && (
        <SlashCommandMenu
          position={slashMenuPosition}
          onSelect={handleCommandSelect}
          onClose={() => setShowSlashMenu(false)}
          isKitPage={!!kitConfig}
        />
      )}

      {/* Background Settings */}
      <BackgroundSettings
        isOpen={showBackgroundSettings}
        onClose={() => setShowBackgroundSettings(false)}
        config={activeBackgroundConfig}
        onChange={setActiveBackground}
      />

      {/* Layout & Spacing Settings */}
      <SpacingSettings
        isOpen={showSpacingSettings}
        onClose={() => setShowSpacingSettings(false)}
        config={spacing}
        onChange={setSpacing}
      />

      {/* Share Dialog */}
      {showShareDialog && id && (
        <ShareDialog
          displayId={id}
          pageTitle={title}
          published={published}
          onClose={() => setShowShareDialog(false)}
        />
      )}

      {/* Collaborate Modal */}
      {id && (
        <CollaborateModal
          isOpen={showCollaborate}
          onClose={() => setShowCollaborate(false)}
          displayId={id}
          isOwner={isOwner}
        />
      )}

      {/* Publish Dialog */}
      {showPublishDialog && id && (
        <PublishDialog
          isOpen={showPublishDialog}
          onClose={() => setShowPublishDialog(false)}
          displayId={id}
          currentCategory={category}
          currentCover={coverImage}
          onPublished={(cat, cover) => { setPublished(true); setCategory(cat); setCoverImage(cover) }}
          pageUrl={pageUrl}
          pageTitle={title}
        />
      )}

      {/* Column Style Settings */}
      <ColumnStyleSettings
        isOpen={showColumnSettings}
        onClose={() => {
          setShowColumnSettings(false)
          setEditingColumnSection(null)
          setEditingColumnId(null)
        }}
        settings={getCurrentColumnSettings()}
        onChange={updateColumnSettings}
      />

      {/* Header Card Editor */}
      <HeaderCardEditor
        isOpen={showHeaderEditor}
        onClose={() => setShowHeaderEditor(false)}
        config={activeHeaderCardConfig}
        onChange={setActiveHeaderCard}
      />

      {/* Card Library Picker */}
      <CardLibraryPicker
        isOpen={cardPickerOpen}
        onClose={() => {
          setCardPickerOpen(false)
          setCurrentSection(null)
          setCurrentColumn(null)
        }}
        onSelect={handleCardPickerSelect}
      />

      <UpgradePrompt isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature="Using library Apps" />

      {/* Tab Editor */}
      <TabEditor
        isOpen={showTabEditor}
        onClose={() => setShowTabEditor(false)}
        config={tabsConfig}
        onChange={(newConfig) => {
          setTabsConfig(newConfig)
          // Set active tab when enabling tabs
          if (newConfig.enabled && newConfig.tabs.length > 0 && !activeTabId) {
            setActiveTabId(newConfig.tabs[0].id)
          }
          // Clear active tab when disabling
          if (!newConfig.enabled) {
            // Migrate first tab's sections back to top-level
            if (tabsConfig.tabs.length > 0) {
              setSections(tabsConfig.tabs[0].sections)
            }
            setActiveTabId(null)
          }
        }}
        currentSections={sections}
      />
    </div>
  )
}
