'use client'

import { useState } from 'react'
import { BarChart2, ChevronDown, ChevronUp } from 'lucide-react'

interface PublicTestScoresElementProps {
  element: {
    id: string
    testScoresTitle?: string
    testScoresEntries?: {
      testName: string
      totalScore: string
      maxScore: string
      sections: { name: string; score: string; maxScore: string }[]
      date: string
    }[]
  }
}

export function PublicTestScoresElement({ element }: PublicTestScoresElementProps) {
  const { testScoresTitle, testScoresEntries } = element
  const [expandedEntries, setExpandedEntries] = useState<Record<number, boolean>>({})

  if (!testScoresEntries || testScoresEntries.length === 0) return null

  const hasAnyScores = testScoresEntries.some(
    (entry) => entry.totalScore && entry.totalScore.trim() !== ''
  )
  if (!hasAnyScores) return null

  const toggleEntry = (index: number) => {
    setExpandedEntries((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  return (
    <div className="space-y-4">
      {testScoresTitle && (
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5" style={{ color: '#6C63FF' }} />
          <h3 className="text-lg font-semibold text-gray-900">{testScoresTitle}</h3>
        </div>
      )}

      <div className="space-y-3">
        {testScoresEntries.map((entry, index) => {
          if (!entry.totalScore || entry.totalScore.trim() === '') return null

          const isExpanded = expandedEntries[index] ?? false
          const hasSections = entry.sections && entry.sections.length > 0

          return (
            <div
              key={index}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden"
            >
              <div
                className={`flex items-center justify-between p-4 ${
                  hasSections ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''
                }`}
                onClick={() => hasSections && toggleEntry(index)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{entry.testName}</span>
                    {entry.date && (
                      <span className="text-sm text-gray-400">{entry.date}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <span className="text-2xl font-bold text-gray-900">
                      {entry.totalScore}
                    </span>
                    {entry.maxScore && (
                      <span className="text-base text-gray-400 ml-1">
                        / {entry.maxScore}
                      </span>
                    )}
                  </div>
                  {hasSections && (
                    <div className="text-gray-400">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && hasSections && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                  {entry.sections.map((section, sIdx) => {
                    const score = parseFloat(section.score) || 0
                    const max = parseFloat(section.maxScore) || 1
                    const percentage = Math.min((score / max) * 100, 100)

                    return (
                      <div key={sIdx} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{section.name}</span>
                          <span className="text-gray-500 font-medium">
                            {section.score}
                            {section.maxScore && (
                              <span className="text-gray-400"> / {section.maxScore}</span>
                            )}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: '#6C63FF',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
