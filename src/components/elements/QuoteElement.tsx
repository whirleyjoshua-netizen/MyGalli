'use client'

import { useRef, useEffect, useState } from 'react'
import { Trash2, Settings, Quote } from 'lucide-react'
import { TextStylePanel } from './TextStylePanel'
import { getTextStyles } from '@/lib/types/canvas'
import { loadGoogleFont } from '@/lib/fonts'
import type { TextStyle } from '@/lib/types/canvas'

interface QuoteElementProps extends TextStyle {
  text: string
  author: string
  onChange: (updates: { text?: string; author?: string } & Partial<TextStyle>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function QuoteElement({
  text,
  author,
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
}: QuoteElementProps) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = 'auto'
      textRef.current.style.height = `${textRef.current.scrollHeight}px`
    }
  }, [text])

  useEffect(() => {
    if (fontFamily) loadGoogleFont(fontFamily)
  }, [fontFamily])

  const styleProps = { fontFamily, fontSize, fontWeight, fontStyle, textAlign, textColor, letterSpacing, lineHeight, textTransform }
  const textStyles = getTextStyles(styleProps)
  // Default italic unless explicitly overridden
  if (!fontStyle) textStyles.fontStyle = 'italic'

  return (
    <div
      className={`relative group transition-all ${isSelected ? 'ring-2 ring-primary rounded-lg' : ''}`}
      onClick={onSelect}
    >
      <blockquote className="border-l-4 border-primary/50 pl-4 py-2">
        <Quote className="w-8 h-8 text-primary/30 mb-2" />

        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
          onFocus={onSelect}
          placeholder="Enter your quote..."
          className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-lg text-foreground placeholder:text-muted-foreground resize-none overflow-hidden"
          style={textStyles}
          rows={1}
        />

        <footer className="mt-2">
          <input
            type="text"
            value={author}
            onChange={(e) => onChange({ author: e.target.value })}
            onFocus={onSelect}
            placeholder="— Author name"
            className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm text-muted-foreground placeholder:text-muted-foreground"
            style={fontFamily ? { fontFamily: `"${fontFamily}", sans-serif` } : undefined}
          />
        </footer>
      </blockquote>

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
