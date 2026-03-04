'use client'

import { UtensilsCrossed } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

const MEAL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Breakfast': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Lunch': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  'Dinner': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Snacks': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
}

export function PublicMealPrepElement({ element }: Props) {
  const title = element.mealPrepTitle || 'Meal Prep'
  const meals = element.mealPrepMeals || []
  const showMacros = element.mealPrepShowMacros ?? false

  return (
    <div className="rounded-2xl border border-border/50 bg-white/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2">
        <UtensilsCrossed className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>

      {/* Grid */}
      <div className="p-4 overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr>
              <th className="pb-2 pr-2 text-left w-20"></th>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <th key={day} className="pb-2 px-1 text-center font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {meals.map((row) => {
              const colors = MEAL_COLORS[row.mealType] || { bg: 'bg-muted', text: 'text-foreground', border: 'border-border' }
              return (
                <tr key={row.mealType} className="align-top">
                  <td className="py-1.5 pr-2">
                    <span className={`inline-block px-2 py-1 rounded-lg text-[10px] font-bold border ${colors.bg} ${colors.text} ${colors.border}`}>
                      {row.mealType}
                    </span>
                  </td>
                  {row.days.map((day) => (
                    <td key={day.day} className="py-1.5 px-1">
                      {day.name ? (
                        <div className={`rounded-lg px-2 py-1.5 ${colors.bg} border ${colors.border}`}>
                          <div className="text-[11px] font-semibold">{day.name}</div>
                          {showMacros && day.macros && (
                            <div className="text-[9px] text-muted-foreground mt-0.5">{day.macros}</div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg px-2 py-1.5 bg-muted/20 min-h-[28px]" />
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
