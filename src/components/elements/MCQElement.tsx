'use client'

import { useState } from 'react'
import { X, Plus, Trash2, CheckCircle } from 'lucide-react'

interface MCQElementProps {
  question: string
  options: string[]
  allowMultiple: boolean
  required: boolean
  onChange: (updates: {
    question?: string
    options?: string[]
    allowMultiple?: boolean
    required?: boolean
  }) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function MCQElement({
  question,
  options,
  allowMultiple,
  required,
  onChange,
  onDelete,
  isSelected,
  onSelect,
}: MCQElementProps) {
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(new Set())

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    onChange({ options: newOptions })
  }

  const addOption = () => {
    onChange({ options: [...options, `Option ${options.length + 1}`] })
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) return // Keep at least 2 options
    const newOptions = options.filter((_, i) => i !== index)
    onChange({ options: newOptions })
  }

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedOptions)
    if (allowMultiple) {
      if (newSelected.has(index)) {
        newSelected.delete(index)
      } else {
        newSelected.add(index)
      }
    } else {
      newSelected.clear()
      newSelected.add(index)
    }
    setSelectedOptions(newSelected)
  }

  return (
    <div
      className={`relative group rounded-lg transition-all ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onSelect}
    >
      <div className="p-4 bg-muted/30 rounded-lg border border-border">
        {/* Question */}
        <div className="mb-4">
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

        {/* Options */}
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-3 group/option">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleSelection(index)
                }}
                className="flex-shrink-0"
              >
                {allowMultiple ? (
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedOptions.has(index)
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border'
                  }`}>
                    {selectedOptions.has(index) && <CheckCircle className="w-3 h-3" />}
                  </div>
                ) : (
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedOptions.has(index)
                      ? 'border-primary'
                      : 'border-border'
                  }`}>
                    {selectedOptions.has(index) && (
                      <div className="w-3 h-3 rounded-full bg-primary" />
                    )}
                  </div>
                )}
              </button>
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1"
                placeholder={`Option ${index + 1}`}
                onClick={(e) => e.stopPropagation()}
              />
              {isSelected && options.length > 2 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeOption(index)
                  }}
                  className="opacity-0 group-hover/option:opacity-100 p-1 text-muted-foreground hover:text-destructive transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add Option Button */}
        {isSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              addOption()
            }}
            className="mt-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <Plus className="w-4 h-4" />
            Add option
          </button>
        )}
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
