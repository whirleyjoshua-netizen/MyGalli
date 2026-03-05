'use client'

import { useState } from 'react'
import { Trash2, Plus, X, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react'

interface TestSection {
  name: string
  score: string
  maxScore: string
}

interface TestEntry {
  testName: string
  totalScore: string
  maxScore: string
  sections: TestSection[]
  date: string
}

interface Props {
  element: any
  onChange: (updates: Record<string, any>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function TestScoresElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const title: string = element.testScoresTitle ?? 'Test Scores'
  const entries: TestEntry[] = element.testScoresEntries ?? []

  const updateEntry = (index: number, updates: Partial<TestEntry>) => {
    const updated = entries.map((entry, i) =>
      i === index ? { ...entry, ...updates } : entry
    )
    onChange({ testScoresEntries: updated })
  }

  const addEntry = () => {
    onChange({
      testScoresEntries: [
        ...entries,
        {
          testName: '',
          totalScore: '',
          maxScore: '',
          sections: [],
          date: '',
        },
      ],
    })
  }

  const removeEntry = (index: number) => {
    if (expandedIndex === index) setExpandedIndex(null)
    else if (expandedIndex !== null && expandedIndex > index) setExpandedIndex(expandedIndex - 1)
    onChange({ testScoresEntries: entries.filter((_, i) => i !== index) })
  }

  const addSection = (entryIndex: number) => {
    const entry = entries[entryIndex]
    updateEntry(entryIndex, {
      sections: [...entry.sections, { name: '', score: '', maxScore: '' }],
    })
  }

  const removeSection = (entryIndex: number, sectionIndex: number) => {
    const entry = entries[entryIndex]
    updateEntry(entryIndex, {
      sections: entry.sections.filter((_, i) => i !== sectionIndex),
    })
  }

  const updateSection = (entryIndex: number, sectionIndex: number, updates: Partial<TestSection>) => {
    const entry = entries[entryIndex]
    const updatedSections = entry.sections.map((sec, i) =>
      i === sectionIndex ? { ...sec, ...updates } : sec
    )
    updateEntry(entryIndex, { sections: updatedSections })
  }

  const toggleExpanded = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected
          ? 'border-[#6C63FF] shadow-md ring-2 ring-[#6C63FF]/20'
          : 'border-border hover:border-[#6C63FF]/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        {/* Title row */}
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-[#6C63FF]" />
          <input
            type="text"
            value={title}
            onChange={(e) => onChange({ testScoresTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold bg-transparent border-none outline-none flex-1"
            placeholder="Test Scores"
          />
        </div>

        {/* Test entries */}
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div
              key={index}
              className="relative bg-muted/30 rounded-lg border border-border overflow-hidden"
            >
              <div className="p-3 space-y-2">
                {/* Test name + remove */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={entry.testName}
                    onChange={(e) => updateEntry(index, { testName: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Test name (e.g. SAT, ACT)"
                    className="flex-1 text-sm font-medium bg-transparent border border-border rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#6C63FF]"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeEntry(index) }}
                    className="p-1 text-muted-foreground hover:text-destructive transition rounded-md hover:bg-destructive/10 flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Score + Date row */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={entry.totalScore}
                    onChange={(e) => updateEntry(index, { totalScore: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Score"
                    className="w-20 text-xs bg-transparent border border-border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#6C63FF] text-center"
                  />
                  <span className="text-xs text-muted-foreground">/</span>
                  <input
                    type="text"
                    value={entry.maxScore}
                    onChange={(e) => updateEntry(index, { maxScore: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Max"
                    className="w-20 text-xs bg-transparent border border-border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#6C63FF] text-center"
                  />
                  <input
                    type="text"
                    value={entry.date}
                    onChange={(e) => updateEntry(index, { date: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Date (e.g. Mar 2026)"
                    className="flex-1 text-xs bg-transparent border border-border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#6C63FF]"
                  />
                </div>

                {/* Expandable section breakdown */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpanded(index) }}
                  className="flex items-center gap-1.5 text-xs text-[#6C63FF] hover:text-[#5a52e0] font-medium transition w-full"
                >
                  {expandedIndex === index ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  Section Breakdown ({entry.sections.length})
                </button>

                {/* Sections */}
                {expandedIndex === index && (
                  <div className="space-y-2 pt-1 pl-2 border-l-2 border-[#6C63FF]/20 ml-1">
                    {entry.sections.map((section, sIndex) => (
                      <div key={sIndex} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={section.name}
                          onChange={(e) => updateSection(index, sIndex, { name: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Section name"
                          className="flex-1 text-xs bg-transparent border border-border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#6C63FF]"
                        />
                        <input
                          type="text"
                          value={section.score}
                          onChange={(e) => updateSection(index, sIndex, { score: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Score"
                          className="w-16 text-xs bg-transparent border border-border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#6C63FF] text-center"
                        />
                        <span className="text-xs text-muted-foreground">/</span>
                        <input
                          type="text"
                          value={section.maxScore}
                          onChange={(e) => updateSection(index, sIndex, { maxScore: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Max"
                          className="w-16 text-xs bg-transparent border border-border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-[#6C63FF] text-center"
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); removeSection(index, sIndex) }}
                          className="p-1 text-muted-foreground hover:text-destructive transition rounded-md hover:bg-destructive/10 flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={(e) => { e.stopPropagation(); addSection(index) }}
                      className="flex items-center gap-1 text-xs text-[#6C63FF] hover:text-[#5a52e0] font-medium transition"
                    >
                      <Plus className="w-3 h-3" />
                      Add Section
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Test button */}
        <button
          onClick={(e) => { e.stopPropagation(); addEntry() }}
          className="flex items-center gap-1.5 text-sm text-[#6C63FF] hover:text-[#5a52e0] font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Test
        </button>
      </div>

      {/* Delete button when selected */}
      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
