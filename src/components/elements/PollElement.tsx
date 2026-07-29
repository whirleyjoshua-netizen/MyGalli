'use client'

import { X, Plus, Trash2, BarChart3 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface PollElementProps {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export function PollElement({ element, onChange, onDelete, isSelected, onSelect }: PollElementProps) {

  const question = element.pollQuestion || 'What do you think?'
  const options = element.pollOptions || ['Option 1', 'Option 2', 'Option 3']

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    onChange({ pollOptions: newOptions })
  }

  const addOption = () => {
    if (options.length >= 8) return
    onChange({ pollOptions: [...options, `Option ${options.length + 1}`] })
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) return
    onChange({ pollOptions: options.filter((_, i) => i !== index) })
  }

  // Fake data for preview
  const fakeVotes = options.map((_, i) => Math.floor(Math.random() * 40) + 5)
  const fakeTotal = fakeVotes.reduce((s, v) => s + v, 0)

  return (
    <div
      className={`relative group rounded-xl border-2 transition-all ${
        isSelected
          ? 'border-purple-500 bg-purple-50/30 dark:bg-purple-900/10'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
      onClick={onSelect}
    >
      {isSelected && (
        <div className="absolute -top-3 right-2 flex items-center gap-1 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:bg-red-50 transition"
          >
            <X className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      )}

      <div className="p-5">
        {/* Question */}
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-purple-500 flex-shrink-0" />
          <input
            type="text"
            value={question}
            onChange={(e) => onChange({ pollQuestion: e.target.value })}
            className="text-lg font-bold bg-transparent border-none outline-none flex-1"
            placeholder="Your question..."
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Options — editable in editor */}
        <div className="space-y-2">
          {options.map((option, index) => {
            const color = COLORS[index % COLORS.length]
            const pct = Math.round((fakeVotes[index] / fakeTotal) * 100)
            return (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1 relative">
                  {/* Background bar preview */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-lg opacity-10"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    className="relative w-full px-3 py-2.5 text-sm font-medium bg-transparent border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder={`Option ${index + 1}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {isSelected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeOption(index) }}
                    className="p-1 text-slate-400 hover:text-red-500 transition disabled:opacity-30"
                    disabled={options.length <= 2}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Add option */}
        {isSelected && options.length < 8 && (
          <button
            onClick={(e) => { e.stopPropagation(); addOption() }}
            className="mt-2 flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add option
          </button>
        )}
      </div>

    </div>
  )
}
