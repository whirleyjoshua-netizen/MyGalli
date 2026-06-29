'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Type,
  Heading,
  Image,
  Play,
  MousePointer,
  List,
  Quote,
  BarChart3,
  Table,
  AlertCircle,
  CircleDot,
  Star,
  MessageSquare,
  PieChart,
  Code2,
  GalleryHorizontal,
  ChevronDown as ChevronDownIcon,
  TrendingUp,
  UserCircle,
  Calendar,
  Dumbbell,
  UtensilsCrossed,
  Shirt,
  Briefcase,
  GraduationCap,
  Award,
  BarChart2,
  Heart,
  Users,
  Mail,
  Gift,
  Hash,
  Clock,
  Grid3X3,
  Palette,
  Music,
  Quote as QuoteIcon,
  BookOpen,
  DollarSign,
  Store,
  Sparkles,
  Blocks,
} from 'lucide-react'
import type { ElementType } from '@/lib/types/canvas'

interface Command {
  id: ElementType
  label: string
  icon: typeof Type
  description: string
  category: string
  disabled?: boolean
  disabledLabel?: string
}

const commands: Command[] = [
  // Text & Content
  { id: 'text', label: 'Text', icon: Type, description: 'Plain text block', category: 'Content' },
  { id: 'heading', label: 'Heading', icon: Heading, description: 'Section heading', category: 'Content' },
  { id: 'quote', label: 'Quote', icon: Quote, description: 'Stylized quote', category: 'Content' },
  { id: 'callout', label: 'Callout', icon: AlertCircle, description: 'Highlighted info box', category: 'Content' },
  { id: 'toggle', label: 'Toggle', icon: ChevronDownIcon, description: 'Collapsible content', category: 'Content' },
  { id: 'code', label: 'Code Block', icon: Code2, description: 'Syntax-highlighted code', category: 'Content' },
  { id: 'timeline', label: 'Timeline', icon: Clock, description: 'Interactive event timeline', category: 'Content' },

  // Data & Visuals
  { id: 'list', label: 'Bulleted List', icon: List, description: 'Simple bullet list', category: 'Data & Visuals' },
  { id: 'table', label: 'Table', icon: Table, description: 'Rows and columns', category: 'Data & Visuals' },
  { id: 'kpi', label: 'KPI / Stat', icon: BarChart3, description: 'Metric with trend', category: 'Data & Visuals' },
  { id: 'chart', label: '3D Chart', icon: PieChart, description: 'Bar, line, or pie chart', category: 'Data & Visuals' },

  // Media
  { id: 'image', label: 'Image', icon: Image, description: 'Add an image', category: 'Media' },
  { id: 'embed', label: 'Embed', icon: Play, description: 'YouTube, Vimeo, or links', category: 'Media' },
  { id: 'button', label: 'Button', icon: MousePointer, description: 'Call-to-action button', category: 'Media' },
  { id: 'slideshow', label: 'Slideshow', icon: GalleryHorizontal, description: 'Image carousel with text overlays', category: 'Media' },

  // Form Elements
  { id: 'mcq', label: 'Multiple Choice', icon: CircleDot, description: 'Question with options', category: 'Forms' },
  { id: 'rating', label: 'Rating', icon: Star, description: 'Star or numeric rating', category: 'Forms' },
  { id: 'shortanswer', label: 'Short Answer', icon: MessageSquare, description: 'Text input field', category: 'Forms' },

  // Social
  { id: 'comment', label: 'Comments', icon: MessageSquare, description: 'Visitor comment section', category: 'Social' },
  { id: 'poll', label: 'Poll', icon: BarChart3, description: 'Vote on options', category: 'Social' },

  // Kit
  { id: 'tracker', label: 'Tracker', icon: TrendingUp, description: 'Track metrics over time', category: 'Kit' },
  { id: 'kit-profile', label: 'Kit Profile', icon: UserCircle, description: 'Structured profile card', category: 'Kit' },
  { id: 'game-schedule', label: 'Game Schedule', icon: Calendar, description: 'Upcoming games table', category: 'Kit' },
  { id: 'workout-schedule', label: 'Workout Schedule', icon: Dumbbell, description: 'Weekly workout planner', category: 'Kit' },
  { id: 'meal-prep', label: 'Meal Prep', icon: UtensilsCrossed, description: 'Weekly meal planner', category: 'Kit' },
  { id: 'jersey', label: 'My Jersey', icon: Shirt, description: 'Interactive jersey card', category: 'Kit' },
  { id: 'experience-entry', label: 'Experience Entry', icon: Briefcase, description: 'Job or role card', category: 'Kit' },
  { id: 'education-entry', label: 'Education Entry', icon: GraduationCap, description: 'School or degree card', category: 'Kit' },
  { id: 'skill-bar', label: 'Skill Bar', icon: BarChart2, description: 'Visual skill proficiency', category: 'Kit' },
  { id: 'certification-badge', label: 'Certification', icon: Award, description: 'Certification badge card', category: 'Kit' },
  // Wedding Kit
  { id: 'wedding-timeline', label: 'Wedding Timeline', icon: Clock, description: 'Event timeline with icons', category: 'Kit' },
  { id: 'wedding-party', label: 'Wedding Party', icon: Users, description: 'Bridal party roster', category: 'Kit' },
  { id: 'wedding-rsvp', label: 'Wedding RSVP', icon: Mail, description: 'Interactive RSVP form', category: 'Kit' },
  { id: 'wedding-stats', label: 'Wedding Stats', icon: Heart, description: 'Fun couple stat counters', category: 'Kit' },
  { id: 'wedding-registry', label: 'Wedding Registry', icon: Gift, description: 'Gift registry links', category: 'Kit' },
  { id: 'wedding-hashtags', label: 'Wedding Hashtags', icon: Hash, description: 'Social media hashtags', category: 'Kit' },
  // Creative Kit
  { id: 'mood-board', label: 'Mood Board', icon: Grid3X3, description: 'Image mood board grid', category: 'Kit' },
  { id: 'color-palette', label: 'Color Palette', icon: Palette, description: 'Color swatch palette', category: 'Kit' },
  { id: 'playlist', label: 'Playlist', icon: Music, description: 'Music playlist', category: 'Kit' },
  { id: 'quote-wall', label: 'Quote Wall', icon: QuoteIcon, description: 'Collection of quotes', category: 'Kit' },
  // Creator Kit
  { id: 'social-stats', label: 'Social Stats', icon: Users, description: 'Social media presence', category: 'Kit' },
  { id: 'collab-card', label: 'Collab Card', icon: Briefcase, description: 'Brand partnership card', category: 'Kit' },
  { id: 'rate-card', label: 'Rate Card', icon: DollarSign, description: 'Package pricing cards', category: 'Kit' },
  // Apps
  { id: 'card', label: 'App Card', icon: Blocks, description: 'Insert a card from your Library', category: 'Apps' },
  { id: 'media-kit-stats', label: 'Media Kit Stats', icon: BarChart2, description: 'Audience demographics', category: 'Kit' },
  // Academic Kit
  { id: 'course-list', label: 'Course List', icon: BookOpen, description: 'Academic course table', category: 'Kit' },
  { id: 'gpa-card', label: 'GPA Card', icon: GraduationCap, description: 'GPA display card', category: 'Kit' },
  { id: 'test-scores', label: 'Test Scores', icon: BarChart2, description: 'SAT, ACT & more', category: 'Kit' },
  { id: 'awards-showcase', label: 'Awards Showcase', icon: Award, description: 'Awards & honors grid', category: 'Kit' },
  // Business Kit
  { id: 'business-menu', label: 'Menu / Catalog', icon: Store, description: 'Product or food menu', category: 'Kit' },
  { id: 'business-hours', label: 'Hours & Location', icon: Clock, description: 'Business hours & contact', category: 'Kit' },
  { id: 'business-review', label: 'Customer Reviews', icon: Star, description: 'Interactive review wall', category: 'Kit' },
  { id: 'business-promo', label: 'Promos & Specials', icon: Sparkles, description: 'Deals & promotions', category: 'Kit' },
]

const CATEGORY_ORDER = ['Content', 'Data & Visuals', 'Media', 'Forms', 'Social', 'Apps', 'Kit']

interface Column {
  category: string
  cmds: Command[]
}

interface SlashCommandMenuProps {
  position: { x: number; y: number }
  onSelect: (type: ElementType) => void
  onClose: () => void
  isKitPage?: boolean
}

export function SlashCommandMenu({ position, onSelect, onClose, isKitPage }: SlashCommandMenuProps) {
  const [search, setSearch] = useState('')
  const [sel, setSel] = useState<{ col: number; row: number }>({ col: 0, row: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter commands based on search and kit visibility
  const filteredCommands = commands.filter((cmd) => {
    if (cmd.category === 'Kit' && !isKitPage) return false
    return (
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.description.toLowerCase().includes(search.toLowerCase()) ||
      cmd.category.toLowerCase().includes(search.toLowerCase())
    )
  })

  // Group into ordered columns (one per category)
  const columns: Column[] = []
  for (const cat of CATEGORY_ORDER) {
    const cmds = filteredCommands.filter((c) => c.category === cat)
    if (cmds.length > 0) columns.push({ category: cat, cmds })
  }

  const clampedCol = Math.min(sel.col, Math.max(columns.length - 1, 0))
  const activeCmds = columns[clampedCol]?.cmds ?? []
  const clampedRow = Math.min(sel.row, Math.max(activeCmds.length - 1, 0))
  const selectedCmd = activeCmds[clampedRow]

  // Reset selection when search changes
  useEffect(() => {
    setSel({ col: 0, row: 0 })
  }, [search])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Scroll selected item into view (horizontal + vertical)
  useEffect(() => {
    const selected = menuRef.current?.querySelector('[data-selected="true"]')
    selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [clampedCol, clampedRow])

  // Keyboard navigation (2D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (columns.length === 0) {
        if (e.key === 'Escape') { e.preventDefault(); onClose() }
        return
      }
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSel((s) => {
            const cmds = columns[Math.min(s.col, columns.length - 1)].cmds
            return { col: Math.min(s.col, columns.length - 1), row: Math.min(s.row + 1, cmds.length - 1) }
          })
          break
        case 'ArrowUp':
          e.preventDefault()
          setSel((s) => ({ col: Math.min(s.col, columns.length - 1), row: Math.max(s.row - 1, 0) }))
          break
        case 'ArrowRight':
          e.preventDefault()
          setSel((s) => {
            const col = Math.min(s.col + 1, columns.length - 1)
            return { col, row: Math.min(s.row, columns[col].cmds.length - 1) }
          })
          break
        case 'ArrowLeft':
          e.preventDefault()
          setSel((s) => {
            const col = Math.max(s.col - 1, 0)
            return { col, row: Math.min(s.row, columns[col].cmds.length - 1) }
          })
          break
        case 'Enter': {
          e.preventDefault()
          const cmd = columns[Math.min(sel.col, columns.length - 1)]?.cmds[clampedRow]
          if (cmd && !cmd.disabled) onSelect(cmd.id)
          break
        }
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [columns, sel, clampedRow, onSelect, onClose])

  // Position to stay in viewport (wide horizontal panel)
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
  const menuWidth = Math.min(viewportWidth - 32, 760)
  const menuHeight = 400

  let adjustedX = position.x
  let adjustedY = position.y
  if (adjustedX + menuWidth > viewportWidth) adjustedX = viewportWidth - menuWidth - 16
  if (adjustedY + menuHeight > viewportHeight) adjustedY = viewportHeight - menuHeight - 16
  adjustedX = Math.max(16, adjustedX)
  adjustedY = Math.max(16, adjustedY)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 bg-surface border border-border rounded-xl shadow-soft-lg overflow-hidden flex flex-col"
        style={{ left: adjustedX, top: adjustedY, width: menuWidth, maxHeight: menuHeight }}
      >
        {/* Search Input */}
        <div className="p-2 border-b border-border flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search elements..."
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg outline-none focus:ring-2 focus:ring-ring text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Columns — horizontal scroll */}
        <div className="overflow-x-auto overflow-y-hidden flex-1 scrollbar-hide">
          {columns.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No elements found</div>
          ) : (
            <div className="flex h-full divide-x divide-border">
              {columns.map((column, colIdx) => (
                <div key={column.category} className="flex flex-col w-[210px] flex-shrink-0 h-full">
                  {/* Category header */}
                  <div className="px-3 py-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-shrink-0 sticky top-0 bg-surface">
                    <span>{column.category}</span>
                    <span className="text-[10px] font-normal normal-case tracking-normal opacity-60 ml-auto">
                      {column.cmds.length}
                    </span>
                  </div>
                  {/* Items — vertical scroll within the column */}
                  <div className="overflow-y-auto flex-1 px-1 pb-1 scrollbar-hide">
                    {column.cmds.map((cmd, rowIdx) => {
                      const isSelected = colIdx === clampedCol && rowIdx === clampedRow
                      if (cmd.disabled) {
                        return (
                          <div key={cmd.id} className="w-full px-2 py-2 flex items-center gap-2.5 opacity-40 cursor-not-allowed rounded-lg">
                            <cmd.icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground truncate">{cmd.label}</span>
                            {cmd.disabledLabel && (
                              <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                {cmd.disabledLabel}
                              </span>
                            )}
                          </div>
                        )
                      }
                      return (
                        <button
                          key={cmd.id}
                          data-selected={isSelected}
                          title={cmd.description}
                          className={`w-full px-2 py-2 flex items-center gap-2.5 rounded-lg transition-colors text-left cursor-pointer ${
                            isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                          }`}
                          onClick={() => onSelect(cmd.id)}
                          onMouseEnter={() => setSel({ col: colIdx, row: rowIdx })}
                        >
                          <cmd.icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className="text-sm font-medium text-foreground truncate">{cmd.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-3 py-1.5 border-t border-border text-[11px] text-muted-foreground bg-muted/30 flex items-center gap-3 flex-shrink-0">
          <span><kbd className="font-mono bg-muted px-1 rounded text-[10px]">↑↓←→</kbd> navigate</span>
          <span><kbd className="font-mono bg-muted px-1 rounded text-[10px]">↵</kbd> select</span>
          <span><kbd className="font-mono bg-muted px-1 rounded text-[10px]">esc</kbd> close</span>
        </div>
      </div>
    </>
  )
}
