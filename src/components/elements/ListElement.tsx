'use client'

import { useRef, useEffect, useState, KeyboardEvent } from 'react'
import { X, Plus, Columns2, Columns3, AlignJustify, Trash2, Settings } from 'lucide-react'
import { TextStylePanel } from './TextStylePanel'
import { getTextStyles } from '@/lib/types/canvas'
import { loadGoogleFont } from '@/lib/fonts'
import type { TextStyle } from '@/lib/types/canvas'

type ListColumns = 1 | 2 | 3

interface ListElementProps extends TextStyle {
  items: string[]
  listType: 'bulleted' | 'numbered'
  title: string
  columns: ListColumns
  onChange: (updates: { items?: string[]; title?: string; columns?: ListColumns } & Partial<TextStyle>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const COLUMN_OPTIONS: { value: ListColumns; icon: typeof AlignJustify; label: string }[] = [
  { value: 1, icon: AlignJustify, label: '1 col' },
  { value: 2, icon: Columns2, label: '2 col' },
  { value: 3, icon: Columns3, label: '3 col' },
]

export function ListElement({
  items,
  listType,
  title,
  columns,
  fontFamily,
  fontSize,
  fontWeight,
  fontStyle,
  textAlign,
  textColor,
  letterSpacing,
  lineHeight,
  textTransform,
  onChange,
  onDelete,
  isSelected,
  onSelect,
}: ListElementProps) {
  const itemRefs = useRef<(HTMLInputElement | null)[]>([])
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (fontFamily) loadGoogleFont(fontFamily)
  }, [fontFamily])

  const handleItemChange = (index: number, value: string) => {
    const newItems = [...items]
    newItems[index] = value
    onChange({ items: newItems })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const newItems = [...items]
      newItems.splice(index + 1, 0, '')
      onChange({ items: newItems })
      setTimeout(() => {
        itemRefs.current[index + 1]?.focus()
      }, 0)
    } else if (e.key === 'Backspace' && items[index] === '' && items.length > 1) {
      e.preventDefault()
      const newItems = items.filter((_, i) => i !== index)
      onChange({ items: newItems })
      setTimeout(() => {
        itemRefs.current[Math.max(0, index - 1)]?.focus()
      }, 0)
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault()
      itemRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowDown' && index < items.length - 1) {
      e.preventDefault()
      itemRefs.current[index + 1]?.focus()
    }
  }

  const addItem = () => {
    onChange({ items: [...items, ''] })
    setTimeout(() => {
      itemRefs.current[items.length]?.focus()
    }, 0)
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      onChange({ items: items.filter((_, i) => i !== index) })
    }
  }

  const ListTag = listType === 'numbered' ? 'ol' : 'ul'

  const columnClass =
    columns === 3 ? 'columns-3 gap-x-6' :
    columns === 2 ? 'columns-2 gap-x-6' :
    ''

  const styleProps = { fontFamily, fontSize, fontWeight, fontStyle, textAlign, textColor, letterSpacing, lineHeight, textTransform }
  const textStyles = getTextStyles(styleProps)

  return (
    <div
      className={`relative group transition-all ${isSelected ? 'ring-2 ring-primary rounded-lg p-2' : ''}`}
      onClick={onSelect}
    >
      {/* Title */}
      {(isSelected || title) && (
        <input
          type="text"
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="List title (optional)"
          className="w-full bg-transparent border-none focus:outline-none focus:ring-0 font-semibold text-lg text-foreground placeholder:text-muted-foreground/50 mb-2"
          style={textStyles}
        />
      )}

      {/* Column layout picker */}
      {isSelected && (
        <div className="flex items-center gap-1 mb-2">
          <span className="text-xs text-muted-foreground mr-1">Layout:</span>
          {COLUMN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={(e) => {
                e.stopPropagation()
                onChange({ columns: opt.value })
              }}
              className={`p-1.5 rounded text-xs ${
                columns === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
              title={opt.label}
            >
              <opt.icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      )}

      <ListTag
        className={`space-y-1 ${listType === 'numbered' ? 'list-decimal' : 'list-disc'} ml-5 ${columnClass}`}
        style={textStyles}
      >
        {items.map((item, index) => (
          <li key={index} className="group/item break-inside-avoid">
            <div className="flex items-center gap-2">
              <input
                ref={(el) => {
                  itemRefs.current[index] = el
                }}
                type="text"
                value={item}
                onChange={(e) => handleItemChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onFocus={onSelect}
                placeholder="List item..."
                className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground py-1"
              />
              {isSelected && items.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeItem(index)
                  }}
                  className="opacity-0 group-hover/item:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ListTag>

      {isSelected && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            addItem()
          }}
          className="mt-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors ml-5"
        >
          <Plus className="w-3 h-3" />
          Add item
        </button>
      )}

      {/* Controls */}
      {isSelected && (
        <div className="absolute -top-3 right-2 flex items-center gap-1 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowSettings(!showSettings)
            }}
            className="p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-muted transition"
          >
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Text Style Panel */}
      {showSettings && isSelected && (
        <TextStylePanel
          {...styleProps}
          onChange={onChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
