'use client'

import { Dumbbell } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicWorkoutScheduleElement({ element }: Props) {
  const title = element.workoutScheduleTitle || 'Weekly Workouts'
  const days = element.workoutScheduleDays || []

  return (
    <div className="rounded-2xl border border-border/50 bg-white/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2">
        <Dumbbell className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>

      {/* Weekly Grid */}
      <div className="p-4 overflow-x-auto">
        <div className="grid grid-cols-7 gap-2 min-w-[600px]">
          {days.map((day) => {
            const hasWorkouts = day.workouts.length > 0
            return (
              <div key={day.day} className="border border-border/40 rounded-xl overflow-hidden">
                {/* Day Header */}
                <div className="bg-muted/40 px-2 py-2 text-center border-b border-border/30">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {day.day}
                  </span>
                </div>

                {/* Workouts */}
                <div className="p-2 space-y-1.5 min-h-[60px]">
                  {hasWorkouts ? (
                    day.workouts.map((workout, wIdx) => (
                      <div key={wIdx} className="bg-primary/5 rounded-lg px-2 py-1.5">
                        <div className="text-xs font-semibold">{workout.name}</div>
                        {workout.setsReps && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{workout.setsReps}</div>
                        )}
                        {workout.notes && (
                          <div className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{workout.notes}</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full min-h-[40px]">
                      <span className="text-[10px] text-muted-foreground/50 uppercase font-medium">Rest</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
