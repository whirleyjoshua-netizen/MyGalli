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
  ChevronRight,
  CircleDot,
  Star,
  MessageSquare,
  PieChart,
  Code2,
  CreditCard,
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

  // Data & Visuals
  { id: 'list', label: 'Bulleted List', icon: List, description: 'Simple bullet list', category: 'Data & Visuals' },
  { id: 'table', label: 'Table', icon: Table, description: 'Rows and columns', category: 'Data & Visuals' },
  { id: 'kpi', label: 'KPI / Stat', icon: BarChart3, description: 'Metric with trend', category: 'Data & Visuals' },
  { id: 'chart', label: '3D Chart', icon: PieChart, description: 'Bar, line, or pie chart', category: 'Data & Visuals' },

  // Media
  { id: 'image', label: 'Image', icon: Image, description: 'Add an image', category: 'Media' },
  { id: 'embed', label: 'Embed', icon: Play, description: 'YouTube, Vimeo, or links', category: 'Media' },
  { id: 'button', label: 'Button', icon: MousePointer, description: 'Call-to-action button', category: 'Media' },

  // Form Elements
  { id: 'mcq', label: 'Multiple Choice', icon: CircleDot, description: 'Question with options', category: 'Forms' },
  { id: 'rating', label: 'Rating', icon: Star, description: 'Star or numeric rating', category: 'Forms' },
  { id: 'shortanswer', label: 'Short Answer', icon: MessageSquare, description: 'Text input field', category: 'Forms' },

  // Social
  { id: 'comment', label: 'Comments', icon: MessageSquare, description: 'Visitor comment section', category: 'Social' },
  { id: 'poll', label: 'Poll', icon: BarChart3, description: 'Vote on options', category: 'Social' },

  // Integrations
  { id: 'card', label: 'App Card', icon: CreditCard, description: 'From your library', category: 'Integrations' },

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
]

const CATEGORY_ORDER = ['Content', 'Data & Visuals', 'Media', 'Forms', 'Social', 'Integrations', 'Kit']

interface SlashCommandMenuProps {
  position: { x: number; y: number }
  onSelect: (type: ElementType) => void
  onClose: () => void
  isKitPage?: boolean
}

export function SlashCommandMenu({ position, onSelect, onClose, isKitPage }: SlashCommandMenuProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isSearching = search.length > 0

  // Filter commands based on search and kit visibility
  const filteredCommands = commands.filter(
    (cmd) => {
      if (cmd.category === 'Kit' && !isKitPage) return false
      return cmd.label.toLowerCase().includes(search.toLowerCase()) ||
        cmd.description.toLowerCase().includes(search.toLowerCase()) ||
        cmd.category.toLowerCase().includes(search.toLowerCase())
    }
  )

  // Group by category
  const groupedCommands: Record<string, Command[]> = {}
  for (const cat of CATEGORY_ORDER) {
    const cmds = filteredCommands.filter(c => c.category === cat)
    if (cmds.length > 0) groupedCommands[cat] = cmds
  }

  // Flatten visible commands (only non-collapsed, non-disabled) for keyboard navigation
  const flatCommands: Command[] = []
  for (const [category, cmds] of Object.entries(groupedCommands)) {
    if (!isSearching && collapsedCategories.has(category)) continue
    flatCommands.push(...cmds.filter(c => !c.disabled))
  }

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => (i + 1) % Math.max(flatCommands.length, 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => (i - 1 + flatCommands.length) % Math.max(flatCommands.length, 1))
          break
        case 'Enter':
          e.preventDefault()
          if (flatCommands[selectedIndex]) {
            onSelect(flatCommands[selectedIndex].id)
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [flatCommands, selectedIndex, onSelect, onClose])

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Scroll selected item into view
  useEffect(() => {
    const selected = menuRef.current?.querySelector('[data-selected="true"]')
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Calculate position to stay in viewport
  const menuHeight = 420
  const menuWidth = 300
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200

  let adjustedX = position.x
  let adjustedY = position.y

  if (adjustedX + menuWidth > viewportWidth) {
    adjustedX = viewportWidth - menuWidth - 20
  }
  if (adjustedY + menuHeight > viewportHeight) {
    adjustedY = viewportHeight - menuHeight - 20
  }
  adjustedX = Math.max(20, adjustedX)
  adjustedY = Math.max(20, adjustedY)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 bg-background border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          left: adjustedX,
          top: adjustedY,
          width: menuWidth,
          maxHeight: 'calc(100vh - 40px)',
        }}
      >
        {/* Search Input */}
        <div className="p-2 border-b border-border flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search elements..."
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Commands List */}
        <div className="overflow-y-auto flex-1 py-1">
          {Object.entries(groupedCommands).map(([category, cmds]) => {
            const isCollapsed = !isSearching && collapsedCategories.has(category)
            return (
              <div key={category}>
                {/* Category toggle header */}
                <button
                  onClick={() => !isSearching && toggleCategory(category)}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:bg-muted/50 transition-colors"
                >
                  {!isSearching && (
                    <ChevronRight
                      className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                    />
                  )}
                  <span>{category}</span>
                  <span className="text-[10px] font-normal normal-case tracking-normal opacity-60 ml-auto">
                    {cmds.length}
                  </span>
                </button>

                {/* Items */}
                {!isCollapsed && (
                  <div>
                    {cmds.map((cmd) => {
                      if (cmd.disabled) {
                        return (
                          <div
                            key={cmd.id}
                            className="w-full px-3 py-2 flex items-center gap-3 opacity-40 cursor-not-allowed"
                          >
                            <cmd.icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-muted-foreground">{cmd.label}</div>
                            </div>
                            {cmd.disabledLabel && (
                              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                {cmd.disabledLabel}
                              </span>
                            )}
                          </div>
                        )
                      }
                      const globalIndex = flatCommands.indexOf(cmd)
                      const isSelected = globalIndex === selectedIndex
                      return (
                        <button
                          key={cmd.id}
                          data-selected={isSelected}
                          className={`w-full px-3 py-2 flex items-center gap-3 transition-colors text-left ${
                            isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                          }`}
                          onClick={() => onSelect(cmd.id)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                        >
                          <cmd.icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground">{cmd.label}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {filteredCommands.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No elements found
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-3 py-1.5 border-t border-border text-[11px] text-muted-foreground bg-muted/30 flex items-center gap-3">
          <span><kbd className="font-mono bg-muted px-1 rounded text-[10px]">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono bg-muted px-1 rounded text-[10px]">↵</kbd> select</span>
          <span><kbd className="font-mono bg-muted px-1 rounded text-[10px]">esc</kbd> close</span>
        </div>
      </div>
    </>
  )
}
