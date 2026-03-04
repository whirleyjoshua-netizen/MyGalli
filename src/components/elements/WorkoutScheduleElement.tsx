'use client'

import { useState } from 'react'
import { Trash2, Plus, Dumbbell } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Workout {
  name: string
  setsReps?: string
  notes?: string
}

interface DaySchedule {
  day: string
  workouts: Workout[]
}

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function WorkoutScheduleElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const title = element.workoutScheduleTitle || 'Weekly Workouts'
  const days: DaySchedule[] = element.workoutScheduleDays || []

  const updateDay = (dayIndex: number, workouts: Workout[]) => {
    const updated = days.map((d, i) =>
      i === dayIndex ? { ...d, workouts } : d
    )
    onChange({ workoutScheduleDays: updated })
  }

  const addWorkout = (dayIndex: number) => {
    const updated = [...days[dayIndex].workouts, { name: '', setsReps: '', notes: '' }]
    updateDay(dayIndex, updated)
  }

  const removeWorkout = (dayIndex: number, workoutIndex: number) => {
    const updated = days[dayIndex].workouts.filter((_, i) => i !== workoutIndex)
    updateDay(dayIndex, updated)
  }

  const updateWorkout = (dayIndex: number, workoutIndex: number, field: keyof Workout, value: string) => {
    const updated = days[dayIndex].workouts.map((w, i) =>
      i === workoutIndex ? { ...w, [field]: value } : w
    )
    updateDay(dayIndex, updated)
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
          <Dumbbell className="w-5 h-5 text-primary" />
          <input
            type="text"
            value={title}
            onChange={(e) => onChange({ workoutScheduleTitle: e.target.value })}
            className="text-lg font-semibold bg-transparent border-none outline-none flex-1"
            placeholder="Weekly Workouts"
          />
        </div>

        {/* Weekly Grid */}
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-2 min-w-[700px]">
            {days.map((day, dayIndex) => (
              <div key={day.day} className="border border-border/50 rounded-lg overflow-hidden">
                {/* Day Header */}
                <div className="bg-muted/50 px-2 py-1.5 text-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">{day.day}</span>
                </div>

                {/* Workouts */}
                <div className="p-1.5 space-y-1.5 min-h-[80px]">
                  {day.workouts.map((workout, wIdx) => (
                    <div key={wIdx} className="bg-muted/30 rounded p-1.5 group/workout relative">
                      <input
                        type="text"
                        value={workout.name}
                        onChange={(e) => updateWorkout(dayIndex, wIdx, 'name', e.target.value)}
                        placeholder="Exercise"
                        className="w-full bg-transparent text-xs font-medium outline-none"
                      />
                      <input
                        type="text"
                        value={workout.setsReps || ''}
                        onChange={(e) => updateWorkout(dayIndex, wIdx, 'setsReps', e.target.value)}
                        placeholder="3x10"
                        className="w-full bg-transparent text-[10px] text-muted-foreground outline-none mt-0.5"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); removeWorkout(dayIndex, wIdx) }}
                        className="absolute top-0.5 right-0.5 p-0.5 opacity-0 group-hover/workout:opacity-100 hover:text-destructive transition"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}

                  {/* Add workout button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); addWorkout(dayIndex) }}
                    className="w-full py-1 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
