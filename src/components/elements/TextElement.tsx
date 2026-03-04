'use client'

import { useRef, useEffect, useState } from 'react'
import { Trash2, Settings } from 'lucide-react'
import { TextStylePanel } from './TextStylePanel'
import { getTextStyles } from '@/lib/types/canvas'
import { loadGoogleFont } from '@/lib/fonts'
import type { TextStyle } from '@/lib/types/canvas'

interface TextElementProps extends TextStyle {
  content: string
  onChange: (updates: { content?: string } & Partial<TextStyle>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function TextElement({
  content,
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
}: TextElementProps) {
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

  const styleProps = { fontFamily, fontSize, fontWeight, fontStyle, textAlign, textColor, letterSpacing, lineHeight, textTransform }

  return (
    <div className="relative group" onClick={onSelect}>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={onSelect}
        className={`w-full min-h-[60px] p-3 bg-transparent rounded-lg focus:outline-none transition-all text-foreground ${
          isSelected
            ? 'ring-2 ring-primary'
            : 'hover:bg-muted/50'
        }`}
        style={{ wordWrap: 'break-word', whiteSpace: 'pre-wrap', ...getTextStyles(styleProps) }}
        suppressContentEditableWarning
      />

      {/* Placeholder */}
      {!content && (
        <div className="absolute top-3 left-3 text-muted-foreground pointer-events-none">
          Start typing...
        </div>
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
