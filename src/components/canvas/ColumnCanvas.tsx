'use client'

import { useState } from 'react'
import { Plus, X, Columns, Columns2, Square, Settings, GripVertical } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type {
  Section,
  Column,
  CanvasElement,
  LayoutMode,
} from '@/lib/types/canvas'
import { DEFAULT_COLUMN_SETTINGS } from '@/lib/types/canvas'
import {
  TextElement,
  HeadingElement,
  ImageElement,
  EmbedElement,
  ButtonElement,
  ListElement,
  QuoteElement,
  KPIElement,
  TableElement,
  CalloutElement,
  ToggleElement,
  MCQElement,
  RatingElement,
  ShortAnswerElement,
  ChartElement,
  CardElement,
  CodeElement,
  CommentElement,
  PollElement,
  TrackerElement,
  KitProfileElement,
  GameScheduleElement,
  WorkoutScheduleElement,
  MealPrepElement,
  JerseyElement,
  ExperienceEntryElement,
  EducationEntryElement,
  SkillBarElement,
  CertificationBadgeElement,
  WeddingTimelineElement,
  WeddingPartyElement,
  WeddingRsvpElement,
  WeddingStatsElement,
  WeddingRegistryElement,
  WeddingHashtagsElement,
} from '@/components/elements'
import { PublicCommentSection } from '@/components/elements/PublicCommentSection'
import { PublicPollElement } from '@/components/elements/PublicPollElement'
import { PublicTrackerElement } from '@/components/elements/PublicTrackerElement'
import { PublicKitProfileElement } from '@/components/elements/PublicKitProfileElement'
import { PublicGameScheduleElement } from '@/components/elements/PublicGameScheduleElement'
import { PublicWorkoutScheduleElement } from '@/components/elements/PublicWorkoutScheduleElement'
import { PublicMealPrepElement } from '@/components/elements/PublicMealPrepElement'
import { PublicJerseyElement } from '@/components/elements/PublicJerseyElement'
import { PublicExperienceEntryElement } from '@/components/elements/PublicExperienceEntryElement'
import { PublicEducationEntryElement } from '@/components/elements/PublicEducationEntryElement'
import { PublicSkillBarElement } from '@/components/elements/PublicSkillBarElement'
import { PublicCertificationBadgeElement } from '@/components/elements/PublicCertificationBadgeElement'
import { PublicWeddingTimelineElement } from '@/components/elements/PublicWeddingTimelineElement'
import { PublicWeddingPartyElement } from '@/components/elements/PublicWeddingPartyElement'
import { PublicWeddingRsvpElement } from '@/components/elements/PublicWeddingRsvpElement'
import { PublicWeddingStatsElement } from '@/components/elements/PublicWeddingStatsElement'
import { PublicWeddingRegistryElement } from '@/components/elements/PublicWeddingRegistryElement'
import { PublicWeddingHashtagsElement } from '@/components/elements/PublicWeddingHashtagsElement'

interface ColumnCanvasProps {
  sections: Section[]
  onSectionsChange: (sections: Section[]) => void
  onAddSection: (layout: LayoutMode) => void
  onDeleteSection: (sectionId: string) => void
  onOpenSlashMenu: (sectionId: string, columnId: string, position?: { x: number; y: number }) => void
  onUpdateElement: (sectionId: string, columnId: string, elementId: string, updates: Partial<CanvasElement>) => void
  onDeleteElement: (sectionId: string, columnId: string, elementId: string) => void
  onOpenColumnSettings?: (sectionId: string, columnId: string) => void
  isPreviewMode?: boolean
  displayId?: string
}

// Sortable element wrapper
interface SortableElementProps {
  id: string
  children: React.ReactNode
  disabled?: boolean
}

function SortableElement({ id, children, disabled }: SortableElementProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group/element">
      {/* Drag Handle */}
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-6 top-1/2 -translate-y-1/2 p-1 cursor-grab active:cursor-grabbing opacity-0 group-hover/element:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      {children}
    </div>
  )
}

export function ColumnCanvas({
  sections,
  onSectionsChange,
  onAddSection,
  onDeleteSection,
  onOpenSlashMenu,
  onUpdateElement,
  onDeleteElement,
  onOpenColumnSettings,
  isPreviewMode = false,
  displayId,
}: ColumnCanvasProps) {
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Find element by id across all sections/columns
  const findElement = (elementId: string): { element: CanvasElement; sectionId: string; columnId: string } | null => {
    for (const section of sections) {
      for (const column of section.columns) {
        const element = column.elements.find((el) => el.id === elementId)
        if (element) {
          return { element, sectionId: section.id, columnId: column.id }
        }
      }
    }
    return null
  }

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const activeData = findElement(active.id as string)
    const overData = findElement(over.id as string)

    if (!activeData || !overData) return

    // Same column - reorder
    if (activeData.columnId === overData.columnId) {
      const newSections = sections.map((section) => {
        if (section.id !== activeData.sectionId) return section

        return {
          ...section,
          columns: section.columns.map((column) => {
            if (column.id !== activeData.columnId) return column

            const oldIndex = column.elements.findIndex((el) => el.id === active.id)
            const newIndex = column.elements.findIndex((el) => el.id === over.id)

            const newElements = [...column.elements]
            const [removed] = newElements.splice(oldIndex, 1)
            newElements.splice(newIndex, 0, removed)

            return { ...column, elements: newElements }
          }),
        }
      })

      onSectionsChange(newSections)
    }
    // Different column - move element
    else {
      const newSections = sections.map((section) => ({
        ...section,
        columns: section.columns.map((column) => {
          // Remove from source column
          if (column.id === activeData.columnId) {
            return {
              ...column,
              elements: column.elements.filter((el) => el.id !== active.id),
            }
          }
          // Add to target column
          if (column.id === overData.columnId) {
            const overIndex = column.elements.findIndex((el) => el.id === over.id)
            const newElements = [...column.elements]
            newElements.splice(overIndex, 0, activeData.element)
            return { ...column, elements: newElements }
          }
          return column
        }),
      }))

      onSectionsChange(newSections)
    }
  }

  // Get column styles based on settings
  const getColumnStyles = (column: Column): React.CSSProperties => {
    const settings = column.settings || DEFAULT_COLUMN_SETTINGS

    const styles: React.CSSProperties = {
      borderRadius: `${settings.borderRadius}px`,
      padding: `${settings.padding}px`,
    }

    if (settings.background === 'solid') {
      styles.backgroundColor = settings.backgroundColor
    } else if (settings.background === 'translucent') {
      styles.backgroundColor = `${settings.backgroundColor}80`
      styles.backdropFilter = 'blur(12px)'
      styles.WebkitBackdropFilter = 'blur(12px)'
      styles.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'
      if (!settings.borderVisible) {
        styles.border = '1px solid rgba(255, 255, 255, 0.2)'
      }
    }

    if (settings.borderVisible) {
      styles.border = `1px solid ${settings.borderColor}`
    }

    return styles
  }

  const hasColumnStyles = (column: Column): boolean => {
    const settings = column.settings
    if (!settings) return false
    return settings.background !== 'transparent' || settings.borderVisible
  }

  const getGridClass = (layout: LayoutMode) => {
    switch (layout) {
      case 'full-width':
        return 'grid-cols-1'
      case 'two-column':
        return 'grid-cols-1 md:grid-cols-2'
      case 'three-column':
        return 'grid-cols-1 md:grid-cols-3'
    }
  }

  const handleColumnKeyDown = (
    e: React.KeyboardEvent,
    sectionId: string,
    columnId: string
  ) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      const target = e.target as HTMLElement
      if (
        target.tagName !== 'INPUT' &&
        target.tagName !== 'TEXTAREA' &&
        !target.isContentEditable
      ) {
        e.preventDefault()
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        onOpenSlashMenu(sectionId, columnId, { x: rect.left + 20, y: rect.top + 40 })
      }
    }
  }

  // Render element
  const renderElement = (
    element: CanvasElement,
    sectionId: string,
    columnId: string
  ) => {
    const isSelected = selectedElement === element.id && !isPreviewMode
    const commonProps = {
      isSelected,
      onSelect: () => !isPreviewMode && setSelectedElement(element.id),
      onDelete: () => onDeleteElement(sectionId, columnId, element.id),
    }

    if (isPreviewMode) {
      commonProps.onSelect = () => {}
      commonProps.onDelete = () => {}
    }

    switch (element.type) {
      case 'text':
        return (
          <TextElement
            {...commonProps}
            content={element.content || ''}
            fontFamily={element.fontFamily}
            fontSize={element.fontSize}
            fontWeight={element.fontWeight}
            fontStyle={element.fontStyle}
            textAlign={element.textAlign}
            textColor={element.textColor}
            letterSpacing={element.letterSpacing}
            lineHeight={element.lineHeight}
            textTransform={element.textTransform}
            onChange={(updates) =>
              onUpdateElement(sectionId, columnId, element.id, updates)
            }
          />
        )

      case 'heading':
        return (
          <HeadingElement
            {...commonProps}
            content={element.content || ''}
            level={element.level || 2}
            fontFamily={element.fontFamily}
            fontSize={element.fontSize}
            fontWeight={element.fontWeight}
            fontStyle={element.fontStyle}
            textAlign={element.textAlign}
            textColor={element.textColor}
            letterSpacing={element.letterSpacing}
            lineHeight={element.lineHeight}
            textTransform={element.textTransform}
            onChange={(updates) =>
              onUpdateElement(sectionId, columnId, element.id, updates)
            }
          />
        )

      case 'image':
        return (
          <ImageElement
            {...commonProps}
            url={element.url || ''}
            alt={element.alt || ''}
            caption={element.caption || ''}
            onChange={(updates) =>
              onUpdateElement(sectionId, columnId, element.id, updates)
            }
          />
        )

      case 'embed':
        return (
          <EmbedElement
            {...commonProps}
            url={element.embedUrl || ''}
            embedType={element.embedType || 'youtube'}
            onChange={(updates) =>
              onUpdateElement(sectionId, columnId, element.id, {
                embedUrl: updates.url,
                embedType: updates.embedType as 'youtube' | 'vimeo' | 'twitter' | 'other',
              })
            }
          />
        )

      case 'button':
        return (
          <ButtonElement
            {...commonProps}
            text={element.buttonText || 'Click me'}
            url={element.buttonUrl || ''}
            variant={element.buttonVariant || 'solid'}
            color={element.buttonColor || 'blue'}
            align={element.buttonAlign || 'left'}
            onChange={(updates) => {
              const mapped: Record<string, any> = {}
              if (updates.text !== undefined) mapped.buttonText = updates.text
              if (updates.url !== undefined) mapped.buttonUrl = updates.url
              if (updates.variant !== undefined) mapped.buttonVariant = updates.variant
              if (updates.color !== undefined) mapped.buttonColor = updates.color
              if (updates.align !== undefined) mapped.buttonAlign = updates.align
              onUpdateElement(sectionId, columnId, element.id, mapped)
            }}
          />
        )

      case 'list':
        return (
          <ListElement
            {...commonProps}
            items={element.items || ['']}
            listType={element.listType || 'bulleted'}
            title={element.listTitle || ''}
            columns={element.listColumns || 1}
            fontFamily={element.fontFamily}
            fontSize={element.fontSize}
            fontWeight={element.fontWeight}
            fontStyle={element.fontStyle}
            textAlign={element.textAlign}
            textColor={element.textColor}
            letterSpacing={element.letterSpacing}
            lineHeight={element.lineHeight}
            textTransform={element.textTransform}
            onChange={(updates) => {
              const mapped: Record<string, any> = {}
              if (updates.items !== undefined) mapped.items = updates.items
              if (updates.title !== undefined) mapped.listTitle = updates.title
              if (updates.columns !== undefined) mapped.listColumns = updates.columns
              // Forward text style fields directly
              if (updates.fontFamily !== undefined) mapped.fontFamily = updates.fontFamily
              if (updates.fontSize !== undefined) mapped.fontSize = updates.fontSize
              if (updates.fontWeight !== undefined) mapped.fontWeight = updates.fontWeight
              if (updates.fontStyle !== undefined) mapped.fontStyle = updates.fontStyle
              if (updates.textAlign !== undefined) mapped.textAlign = updates.textAlign
              if (updates.textColor !== undefined) mapped.textColor = updates.textColor
              if (updates.letterSpacing !== undefined) mapped.letterSpacing = updates.letterSpacing
              if (updates.lineHeight !== undefined) mapped.lineHeight = updates.lineHeight
              if (updates.textTransform !== undefined) mapped.textTransform = updates.textTransform
              onUpdateElement(sectionId, columnId, element.id, mapped)
            }}
          />
        )

      case 'quote':
        return (
          <QuoteElement
            {...commonProps}
            text={element.quoteText || ''}
            author={element.quoteAuthor || ''}
            fontFamily={element.fontFamily}
            fontSize={element.fontSize}
            fontWeight={element.fontWeight}
            fontStyle={element.fontStyle}
            textAlign={element.textAlign}
            textColor={element.textColor}
            letterSpacing={element.letterSpacing}
            lineHeight={element.lineHeight}
            textTransform={element.textTransform}
            onChange={(updates) => {
              const mapped: Record<string, any> = {}
              if (updates.text !== undefined) mapped.quoteText = updates.text
              if (updates.author !== undefined) mapped.quoteAuthor = updates.author
              // Forward text style fields directly
              if (updates.fontFamily !== undefined) mapped.fontFamily = updates.fontFamily
              if (updates.fontSize !== undefined) mapped.fontSize = updates.fontSize
              if (updates.fontWeight !== undefined) mapped.fontWeight = updates.fontWeight
              if (updates.fontStyle !== undefined) mapped.fontStyle = updates.fontStyle
              if (updates.textAlign !== undefined) mapped.textAlign = updates.textAlign
              if (updates.textColor !== undefined) mapped.textColor = updates.textColor
              if (updates.letterSpacing !== undefined) mapped.letterSpacing = updates.letterSpacing
              if (updates.lineHeight !== undefined) mapped.lineHeight = updates.lineHeight
              if (updates.textTransform !== undefined) mapped.textTransform = updates.textTransform
              onUpdateElement(sectionId, columnId, element.id, mapped)
            }}
          />
        )

      case 'kpi':
        return (
          <KPIElement
            {...commonProps}
            label={element.kpiLabel || 'Metric'}
            value={element.kpiValue || '0'}
            prefix={element.kpiPrefix || ''}
            suffix={element.kpiSuffix || ''}
            trend={element.kpiTrend || 'neutral'}
            trendValue={element.kpiTrendValue || ''}
            color={element.kpiColor || 'blue'}
            onChange={(updates) => {
              const mapped: Record<string, any> = {}
              if (updates.label !== undefined) mapped.kpiLabel = updates.label
              if (updates.value !== undefined) mapped.kpiValue = updates.value
              if (updates.prefix !== undefined) mapped.kpiPrefix = updates.prefix
              if (updates.suffix !== undefined) mapped.kpiSuffix = updates.suffix
              if (updates.trend !== undefined) mapped.kpiTrend = updates.trend
              if (updates.trendValue !== undefined) mapped.kpiTrendValue = updates.trendValue
              if (updates.color !== undefined) mapped.kpiColor = updates.color
              onUpdateElement(sectionId, columnId, element.id, mapped)
            }}
          />
        )

      case 'table':
        return (
          <TableElement
            {...commonProps}
            headers={element.tableHeaders || ['Column 1', 'Column 2', 'Column 3']}
            rows={element.tableRows || [['', '', '']]}
            onChange={(updates) =>
              onUpdateElement(sectionId, columnId, element.id, {
                tableHeaders: updates.headers,
                tableRows: updates.rows,
              })
            }
          />
        )

      case 'callout':
        return (
          <CalloutElement
            {...commonProps}
            type={element.calloutType || 'info'}
            title={element.calloutTitle || ''}
            content={element.calloutContent || ''}
            fontFamily={element.fontFamily}
            fontSize={element.fontSize}
            fontWeight={element.fontWeight}
            fontStyle={element.fontStyle}
            textAlign={element.textAlign}
            textColor={element.textColor}
            letterSpacing={element.letterSpacing}
            lineHeight={element.lineHeight}
            textTransform={element.textTransform}
            onChange={(updates) => {
              const mapped: Record<string, any> = {}
              if (updates.type !== undefined) mapped.calloutType = updates.type
              if (updates.title !== undefined) mapped.calloutTitle = updates.title
              if (updates.content !== undefined) mapped.calloutContent = updates.content
              // Forward text style fields directly
              if (updates.fontFamily !== undefined) mapped.fontFamily = updates.fontFamily
              if (updates.fontSize !== undefined) mapped.fontSize = updates.fontSize
              if (updates.fontWeight !== undefined) mapped.fontWeight = updates.fontWeight
              if (updates.fontStyle !== undefined) mapped.fontStyle = updates.fontStyle
              if (updates.textAlign !== undefined) mapped.textAlign = updates.textAlign
              if (updates.textColor !== undefined) mapped.textColor = updates.textColor
              if (updates.letterSpacing !== undefined) mapped.letterSpacing = updates.letterSpacing
              if (updates.lineHeight !== undefined) mapped.lineHeight = updates.lineHeight
              if (updates.textTransform !== undefined) mapped.textTransform = updates.textTransform
              onUpdateElement(sectionId, columnId, element.id, mapped)
            }}
          />
        )

      case 'toggle':
        return (
          <ToggleElement
            {...commonProps}
            title={element.toggleTitle ?? 'Click to expand'}
            content={element.toggleContent ?? ''}
            isOpen={element.toggleOpen ?? false}
            onChange={(updates) => {
              const patch: Record<string, unknown> = {}
              if (updates.title !== undefined) patch.toggleTitle = updates.title
              if (updates.content !== undefined) patch.toggleContent = updates.content
              if (updates.isOpen !== undefined) patch.toggleOpen = updates.isOpen
              onUpdateElement(sectionId, columnId, element.id, patch)
            }}
          />
        )

      case 'mcq':
        return (
          <MCQElement
            {...commonProps}
            question={element.mcqQuestion ?? 'Your question here'}
            options={element.mcqOptions ?? ['Option 1', 'Option 2', 'Option 3']}
            allowMultiple={element.mcqAllowMultiple ?? false}
            required={element.mcqRequired ?? false}
            onChange={(updates) => {
              const patch: Record<string, unknown> = {}
              if (updates.question !== undefined) patch.mcqQuestion = updates.question
              if (updates.options !== undefined) patch.mcqOptions = updates.options
              if (updates.allowMultiple !== undefined) patch.mcqAllowMultiple = updates.allowMultiple
              if (updates.required !== undefined) patch.mcqRequired = updates.required
              onUpdateElement(sectionId, columnId, element.id, patch)
            }}
          />
        )

      case 'rating':
        return (
          <RatingElement
            {...commonProps}
            question={element.ratingQuestion ?? 'How would you rate this?'}
            max={element.ratingMax ?? 5}
            style={element.ratingStyle ?? 'stars'}
            required={element.ratingRequired ?? false}
            onChange={(updates) => {
              const patch: Record<string, unknown> = {}
              if (updates.question !== undefined) patch.ratingQuestion = updates.question
              if (updates.max !== undefined) patch.ratingMax = updates.max
              if (updates.style !== undefined) patch.ratingStyle = updates.style
              if (updates.required !== undefined) patch.ratingRequired = updates.required
              onUpdateElement(sectionId, columnId, element.id, patch)
            }}
          />
        )

      case 'shortanswer':
        return (
          <ShortAnswerElement
            {...commonProps}
            question={element.shortAnswerQuestion ?? 'Your question here'}
            placeholder={element.shortAnswerPlaceholder ?? 'Type your answer...'}
            required={element.shortAnswerRequired ?? false}
            maxLength={element.shortAnswerMaxLength ?? 500}
            onChange={(updates) => {
              const patch: Record<string, unknown> = {}
              if (updates.question !== undefined) patch.shortAnswerQuestion = updates.question
              if (updates.placeholder !== undefined) patch.shortAnswerPlaceholder = updates.placeholder
              if (updates.required !== undefined) patch.shortAnswerRequired = updates.required
              if (updates.maxLength !== undefined) patch.shortAnswerMaxLength = updates.maxLength
              onUpdateElement(sectionId, columnId, element.id, patch)
            }}
          />
        )

      case 'chart':
        return (
          <ChartElement
            {...commonProps}
            element={element}
            onChange={(updates) =>
              onUpdateElement(sectionId, columnId, element.id, updates)
            }
          />
        )

      case 'code':
        return (
          <CodeElement
            {...commonProps}
            content={element.codeContent || '// Write your code here\nconsole.log("Hello, world!");'}
            language={element.codeLanguage || 'javascript'}
            theme={element.codeTheme || 'dark'}
            showLineNumbers={element.codeShowLineNumbers ?? true}
            filename={element.codeFilename || ''}
            onChange={(updates) =>
              onUpdateElement(sectionId, columnId, element.id, {
                codeContent: updates.content,
                codeLanguage: updates.language,
                codeTheme: updates.theme,
                codeShowLineNumbers: updates.showLineNumbers,
                codeFilename: updates.filename,
              })
            }
          />
        )

      case 'card':
        return (
          <CardElement
            {...commonProps}
            provider={element.cardProvider || 'linkedin'}
            data={element.cardData || {}}
            style={element.cardStyle || 'default'}
            onChange={(updates) =>
              onUpdateElement(sectionId, columnId, element.id, updates)
            }
          />
        )

      case 'comment':
        if (isPreviewMode && displayId) {
          return <PublicCommentSection element={element} displayId={displayId} />
        }
        return (
          <CommentElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'poll':
        if (isPreviewMode && displayId) {
          return <PublicPollElement element={element} displayId={displayId} />
        }
        return (
          <PollElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'tracker':
        if (isPreviewMode && displayId) {
          return <PublicTrackerElement element={element} displayId={displayId} />
        }
        return (
          <TrackerElement
            element={element}
            displayId={displayId || ''}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'kit-profile':
        if (isPreviewMode) {
          return <PublicKitProfileElement element={element} />
        }
        return (
          <KitProfileElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'game-schedule':
        if (isPreviewMode) {
          return <PublicGameScheduleElement element={element} />
        }
        return (
          <GameScheduleElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'workout-schedule':
        if (isPreviewMode) {
          return <PublicWorkoutScheduleElement element={element} />
        }
        return (
          <WorkoutScheduleElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'meal-prep':
        if (isPreviewMode) {
          return <PublicMealPrepElement element={element} />
        }
        return (
          <MealPrepElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'jersey':
        if (isPreviewMode && displayId) {
          return <PublicJerseyElement element={element} displayId={displayId} />
        }
        return (
          <JerseyElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'experience-entry':
        if (isPreviewMode) {
          return <PublicExperienceEntryElement element={element} />
        }
        return (
          <ExperienceEntryElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'education-entry':
        if (isPreviewMode) {
          return <PublicEducationEntryElement element={element} />
        }
        return (
          <EducationEntryElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'skill-bar':
        if (isPreviewMode) {
          return <PublicSkillBarElement element={element} />
        }
        return (
          <SkillBarElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'certification-badge':
        if (isPreviewMode) {
          return <PublicCertificationBadgeElement element={element} />
        }
        return (
          <CertificationBadgeElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'wedding-timeline':
        if (isPreviewMode) {
          return <PublicWeddingTimelineElement element={element} />
        }
        return (
          <WeddingTimelineElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'wedding-party':
        if (isPreviewMode) {
          return <PublicWeddingPartyElement element={element} />
        }
        return (
          <WeddingPartyElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'wedding-rsvp':
        if (isPreviewMode && displayId) {
          return <PublicWeddingRsvpElement element={element} displayId={displayId} />
        }
        return (
          <WeddingRsvpElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'wedding-stats':
        if (isPreviewMode) {
          return <PublicWeddingStatsElement element={element} />
        }
        return (
          <WeddingStatsElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'wedding-registry':
        if (isPreviewMode) {
          return <PublicWeddingRegistryElement element={element} />
        }
        return (
          <WeddingRegistryElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      case 'wedding-hashtags':
        if (isPreviewMode) {
          return <PublicWeddingHashtagsElement element={element} />
        }
        return (
          <WeddingHashtagsElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )

      default:
        return (
          <div className="p-4 border border-border rounded-lg text-muted-foreground">
            Unknown element type: {element.type}
          </div>
        )
    }
  }

  // Get active element for drag overlay
  const activeElement = activeId ? findElement(activeId) : null

  // Empty state
  if (sections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground mb-2">
            Start building your page
          </h3>
          <p className="text-muted-foreground mb-6">
            Add a section to get started
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => onAddSection('full-width')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
            >
              <Square className="w-4 h-4" />
              Full Width
            </button>
            <button
              onClick={() => onAddSection('two-column')}
              className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition"
            >
              <Columns2 className="w-4 h-4" />
              Two Columns
            </button>
            <button
              onClick={() => onAddSection('three-column')}
              className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition"
            >
              <Columns className="w-4 h-4" />
              Three Columns
            </button>
          </div>
        </div>
      </div>
    )
  }

  // All element IDs for the DnD context
  const allElementIds = sections.flatMap((section) =>
    section.columns.flatMap((column) => column.elements.map((el) => el.id))
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex-1 p-8 min-h-full"
        onClick={() => setSelectedElement(null)}
      >
        <div className="max-w-6xl mx-auto space-y-6">
          {sections.map((section, sectionIndex) => (
            <div
              key={section.id}
              className="relative group/section"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Section Header */}
              {!isPreviewMode && (
                <div className="flex items-center justify-between mb-3 opacity-0 group-hover/section:opacity-100 transition-opacity">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Section {sectionIndex + 1} • {section.layout.replace('-', ' ')}
                  </div>
                  <button
                    onClick={() => onDeleteSection(section.id)}
                    className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Section Content */}
              <div className={`grid gap-4 ${getGridClass(section.layout)}`}>
                {section.columns.map((column) => (
                  <div
                    key={column.id}
                    className={`min-h-[120px] group/column relative transition-all ${
                      !isPreviewMode && !hasColumnStyles(column)
                        ? 'border border-dashed border-border/50 hover:border-border rounded-lg p-4'
                        : ''
                    }`}
                    style={hasColumnStyles(column) || isPreviewMode ? getColumnStyles(column) : undefined}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => !isPreviewMode && handleColumnKeyDown(e, section.id, column.id)}
                    tabIndex={isPreviewMode ? -1 : 0}
                  >
                    {/* Column Settings Button */}
                    {!isPreviewMode && onOpenColumnSettings && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenColumnSettings(section.id, column.id)
                        }}
                        className={`absolute top-2 right-2 p-1.5 rounded-md transition-all z-10 ${
                          hasColumnStyles(column)
                            ? 'bg-primary/10 text-primary opacity-70 hover:opacity-100'
                            : 'bg-muted/80 text-muted-foreground opacity-0 group-hover/column:opacity-100 hover:text-foreground'
                        }`}
                        title="Column style settings"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Column Elements with Sortable Context */}
                    <SortableContext
                      items={column.elements.map((el) => el.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-4 pl-4">
                        {column.elements.map((element) => (
                          <SortableElement
                            key={element.id}
                            id={element.id}
                            disabled={isPreviewMode}
                          >
                            <div onClick={(e) => e.stopPropagation()}>
                              {renderElement(element, section.id, column.id)}
                            </div>
                          </SortableElement>
                        ))}
                      </div>
                    </SortableContext>

                    {/* Empty Column Prompt */}
                    {!isPreviewMode && column.elements.length === 0 && (
                      <button
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          onOpenSlashMenu(section.id, column.id, { x: rect.left + 20, y: rect.top + 40 })
                        }}
                        className="w-full h-full min-h-[80px] flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span className="text-sm">
                          Press{' '}
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                            /
                          </span>{' '}
                          to add content
                        </span>
                      </button>
                    )}

                    {/* Add Element Button */}
                    {!isPreviewMode && column.elements.length > 0 && (
                      <button
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          onOpenSlashMenu(section.id, column.id, { x: rect.left, y: rect.bottom + 8 })
                        }}
                        className="mt-4 ml-4 w-[calc(100%-1rem)] py-2 border border-dashed border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors opacity-0 group-hover/column:opacity-100 flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm">Add element</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Add Section Buttons */}
          {!isPreviewMode && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => onAddSection('full-width')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg transition"
              >
                <Plus className="w-4 h-4" />
                Full Width
              </button>
              <button
                onClick={() => onAddSection('two-column')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg transition"
              >
                <Plus className="w-4 h-4" />
                Two Column
              </button>
              <button
                onClick={() => onAddSection('three-column')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg transition"
              >
                <Plus className="w-4 h-4" />
                Three Column
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drag Overlay - shows element being dragged */}
      <DragOverlay>
        {activeElement && (
          <div className="opacity-80 shadow-lg rounded-lg bg-background">
            {renderElement(
              activeElement.element,
              activeElement.sectionId,
              activeElement.columnId
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
