'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface ShortAnswerElementProps {
  question: string
  placeholder: string
  required: boolean
  maxLength: number
  onChange: (updates: {
    question?: string
    placeholder?: string
    required?: boolean
    maxLength?: number
  }) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function ShortAnswerElement({
  question,
  placeholder,
  required,
  maxLength,
  onChange,
  onDelete,
  isSelected,
  onSelect,
}: ShortAnswerElementProps) {
  const [inputValue, setInputValue] = useState('')

  return (
    <div
      className={`relative group rounded-lg transition-all ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onSelect}
    >
      <div className="p-4 bg-muted/30 rounded-lg border border-border">
        {/* Question */}
        <div className="mb-3">
          <input
            type="text"
            value={question}
            onChange={(e) => onChange({ question: e.target.value })}
            className="w-full text-lg font-medium bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1"
            placeholder="Your question here"
            onClick={(e) => e.stopPropagation()}
          />
          {required && (
            <span className="text-destructive text-sm ml-2">*</span>
          )}
        </div>

        {/* Text Input */}
        <div className="relative">
          <textarea
            value={inputValue}
            onChange={(e) => {
              if (e.target.value.length <= maxLength) {
                setInputValue(e.target.value)
              }
            }}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={3}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
            {inputValue.length} / {maxLength}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 flex gap-1">
          <button
            className="p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors z-10"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            type="button"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}
