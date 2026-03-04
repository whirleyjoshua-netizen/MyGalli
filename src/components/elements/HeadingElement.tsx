'use client'

import { useRef, useEffect, useState } from 'react'
import { Trash2, Settings } from 'lucide-react'
import { TextStylePanel } from './TextStylePanel'
import { getTextStyles } from '@/lib/types/canvas'
import { loadGoogleFont } from '@/lib/fonts'
import type { TextStyle } from '@/lib/types/canvas'

interface HeadingElementProps extends TextStyle {
  content: string
  level: 1 | 2 | 3 | 4 | 5 | 6
  onChange: (updates: { content?: string; level?: 1 | 2 | 3 | 4 | 5 | 6 } & Partial<TextStyle>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const FONT_SIZES: Record<number, string> = {
  1: 'text-4xl',
  2: 'text-3xl',
  3: 'text-2xl',
  4: 'text-xl',
  5: 'text-lg',
  6: 'text-base',
}

export function HeadingElement({
  content,
  level,
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
}: HeadingElementProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content || ''
    }
  }, [content])

  useEffect(() => {
    if (fontFamily) loadGoogleFont(fontFamily)
  }, [fontFamily])

  const handleInput = () => {
    if (editorRef.current) {
      onChange({ content: editorRef.current.innerHTML })
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
    }
  }

  const styleProps = { fontFamily, fontSize, fontWeight, fontStyle, textAlign, textColor, letterSpacing, lineHeight, textTransform }
  // If custom fontSize is set, skip the Tailwind size class
  const sizeClass = fontSize ? '' : FONT_SIZES[level]
  // If custom fontWeight is set, skip the default bold
  const weightClass = fontWeight ? '' : 'font-bold'

  return (
    <div className="relative group" onClick={onSelect}>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onFocus={onSelect}
        className={`w-full ${weightClass} ${sizeClass} bg-transparent focus:outline-none transition-all text-foreground py-1 ${
          isSelected ? 'ring-2 ring-primary rounded' : ''
        }`}
        style={{ wordWrap: 'break-word', whiteSpace: 'pre-wrap', ...getTextStyles(styleProps) }}
        suppressContentEditableWarning
      />

      {/* Placeholder */}
      {!content && (
        <div
          className={`absolute top-1 left-0 text-muted-foreground pointer-events-none ${weightClass} ${sizeClass}`}
          style={getTextStyles(styleProps)}
        >
          Heading {level}
        </div>
      )}

      {/* Controls */}
      {isSelected && (
        <div className="absolute -top-3 right-2 flex items-center gap-1 z-10">
          {/* Level selector */}
          <select
            value={level}
            onChange={(e) => onChange({ level: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6 })}
            onClick={(e) => e.stopPropagation()}
            className="px-1.5 py-1 text-xs bg-background border border-border rounded-md shadow-sm"
          >
            {[1, 2, 3, 4, 5, 6].map((l) => (
              <option key={l} value={l}>H{l}</option>
            ))}
          </select>
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
