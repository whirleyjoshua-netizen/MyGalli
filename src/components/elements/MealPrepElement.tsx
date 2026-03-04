'use client'

import { useState } from 'react'
import { Trash2, UtensilsCrossed, Eye, EyeOff } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface MealDay {
  day: string
  name: string
  notes?: string
  macros?: string
}

interface MealRow {
  mealType: string
  days: MealDay[]
}

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const MEAL_COLORS: Record<string, string> = {
  'Breakfast': 'bg-amber-50 border-amber-200',
  'Lunch': 'bg-green-50 border-green-200',
  'Dinner': 'bg-blue-50 border-blue-200',
  'Snacks': 'bg-purple-50 border-purple-200',
}

export function MealPrepElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const title = element.mealPrepTitle || 'Meal Prep'
  const meals: MealRow[] = element.mealPrepMeals || []
  const showMacros = element.mealPrepShowMacros ?? false

  const updateCell = (mealIndex: number, dayIndex: number, field: keyof MealDay, value: string) => {
    const updated = meals.map((row, mi) =>
      mi === mealIndex
        ? {
            ...row,
            days: row.days.map((d, di) =>
              di === dayIndex ? { ...d, [field]: value } : d
            ),
          }
        : row
    )
    onChange({ mealPrepMeals: updated })
  }

  return (
    <div
      className={`relative rounded-xl border transition-all ${
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-border/80'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      {/* Controls */}
      {isSelected && (
        <div className="absolute -top-3 right-2 flex items-center gap-1 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onChange({ mealPrepShowMacros: !showMacros })
            }}
            className="p-1.5 rounded-lg bg-background border border-border shadow-sm hover:bg-muted transition"
            title={showMacros ? 'Hide macros' : 'Show macros'}
          >
            {showMacros ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg bg-background border border-border shadow-sm hover:bg-destructive/10 hover:text-destructive transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="p-4">
        {/* Title */}
        <div className="flex items-center gap-2 mb-4">
          <UtensilsCrossed className="w-5 h-5 text-primary" />
          <input
            type="text"
            value={title}
            onChange={(e) => onChange({ mealPrepTitle: e.target.value })}
            className="text-lg font-semibold bg-transparent border-none outline-none flex-1"
            placeholder="Meal Prep"
          />
        </div>

        {/* Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr>
                <th className="pb-2 pr-2 text-left font-medium text-muted-foreground w-20"></th>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <th key={day} className="pb-2 px-1 text-center font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meals.map((row, mealIndex) => (
                <tr key={row.mealType} className="align-top">
                  <td className="py-1 pr-2">
                    <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-semibold border ${MEAL_COLORS[row.mealType] || 'bg-muted border-border'}`}>
                      {row.mealType}
                    </span>
                  </td>
                  {row.days.map((day, dayIndex) => (
                    <td key={day.day} className="py-1 px-1">
                      <div className="border border-border/50 rounded-lg p-1.5 min-h-[48px] hover:border-border transition">
                        <input
                          type="text"
                          value={day.name}
                          onChange={(e) => updateCell(mealIndex, dayIndex, 'name', e.target.value)}
                          placeholder="Meal..."
                          className="w-full bg-transparent outline-none text-[11px] font-medium"
                        />
                        {showMacros && (
                          <input
                            type="text"
                            value={day.macros || ''}
                            onChange={(e) => updateCell(mealIndex, dayIndex, 'macros', e.target.value)}
                            placeholder="Macros"
                            className="w-full bg-transparent outline-none text-[9px] text-muted-foreground mt-0.5"
                          />
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
