'use client'

import { Trash2, Plus, X, BookOpen } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

interface Course {
  name: string
  code: string
  grade: string
  credits: string
  semester: string
  category: string
}

export function CourseListElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const courses: Course[] = element.courseListCourses ?? []

  const updateCourse = (index: number, field: keyof Course, value: string) => {
    const updated = [...courses]
    updated[index] = { ...updated[index], [field]: value }
    onChange({ courseListCourses: updated })
  }

  const addCourse = () => {
    onChange({
      courseListCourses: [
        ...courses,
        { name: '', code: '', grade: '', credits: '', semester: '', category: '' },
      ],
    })
  }

  const removeCourse = (index: number) => {
    onChange({ courseListCourses: courses.filter((_, i) => i !== index) })
  }

  const computeGPA = () => {
    const gradePoints: Record<string, number> = {
      'A+': 4.0, 'A': 4.0, 'A-': 3.7,
      'B+': 3.3, 'B': 3.0, 'B-': 2.7,
      'C+': 2.3, 'C': 2.0, 'C-': 1.7,
      'D+': 1.3, 'D': 1.0, 'D-': 0.7,
      'F': 0.0,
    }
    let totalPoints = 0
    let totalCredits = 0
    for (const course of courses) {
      const pts = gradePoints[course.grade.toUpperCase()]
      const creds = parseFloat(course.credits)
      if (pts !== undefined && !isNaN(creds) && creds > 0) {
        totalPoints += pts * creds
        totalCredits += creds
      }
    }
    return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '—'
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected
          ? 'border-[#6C63FF] shadow-md ring-2 ring-[#6C63FF]/20'
          : 'border-border hover:border-border/80'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      {/* Delete button */}
      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-2 -right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 transition"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#6C63FF]" />
          <span className="text-xs font-medium text-[#6C63FF] uppercase tracking-wide">Course List</span>
        </div>

        {/* Editable title */}
        <input
          type="text"
          value={element.courseListTitle ?? 'My Courses'}
          onChange={(e) => onChange({ courseListTitle: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-full text-sm font-semibold bg-transparent border-none outline-none"
          placeholder="Course list title..."
        />

        {/* Column headers */}
        {courses.length > 0 && (
          <div className="grid grid-cols-[1fr_80px_50px_55px_80px_80px_28px] gap-1.5 px-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            <span>Course</span>
            <span>Code</span>
            <span>Grade</span>
            <span>Credits</span>
            <span>Semester</span>
            <span>Category</span>
            <span />
          </div>
        )}

        {/* Course rows */}
        <div className="space-y-1.5">
          {courses.map((course, index) => (
            <div
              key={index}
              className="group/row grid grid-cols-[1fr_80px_50px_55px_80px_80px_28px] gap-1.5 items-center bg-muted/30 rounded-lg px-1 py-1 border border-border/50 hover:border-border transition"
            >
              <input
                type="text"
                value={course.name}
                onChange={(e) => updateCourse(index, 'name', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Course name"
                className="text-xs bg-transparent border border-transparent hover:border-border focus:border-[#6C63FF] rounded px-1.5 py-1 outline-none min-w-0"
              />
              <input
                type="text"
                value={course.code}
                onChange={(e) => updateCourse(index, 'code', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Code"
                className="text-xs bg-transparent border border-transparent hover:border-border focus:border-[#6C63FF] rounded px-1.5 py-1 outline-none min-w-0"
              />
              <input
                type="text"
                value={course.grade}
                onChange={(e) => updateCourse(index, 'grade', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="A"
                className="text-xs bg-transparent border border-transparent hover:border-border focus:border-[#6C63FF] rounded px-1.5 py-1 outline-none min-w-0 text-center"
              />
              <input
                type="text"
                value={course.credits}
                onChange={(e) => updateCourse(index, 'credits', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="3"
                className="text-xs bg-transparent border border-transparent hover:border-border focus:border-[#6C63FF] rounded px-1.5 py-1 outline-none min-w-0 text-center"
              />
              <input
                type="text"
                value={course.semester}
                onChange={(e) => updateCourse(index, 'semester', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Fall 2025"
                className="text-xs bg-transparent border border-transparent hover:border-border focus:border-[#6C63FF] rounded px-1.5 py-1 outline-none min-w-0"
              />
              <input
                type="text"
                value={course.category}
                onChange={(e) => updateCourse(index, 'category', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Core"
                className="text-xs bg-transparent border border-transparent hover:border-border focus:border-[#6C63FF] rounded px-1.5 py-1 outline-none min-w-0"
              />
              <button
                onClick={(e) => { e.stopPropagation(); removeCourse(index) }}
                className="p-1 opacity-0 group-hover/row:opacity-100 hover:text-destructive transition flex-shrink-0 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add course button */}
        <button
          onClick={(e) => { e.stopPropagation(); addCourse() }}
          className="flex items-center gap-1.5 text-sm text-[#6C63FF] hover:text-[#5a52e0] font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add course
        </button>

        {/* GPA toggle + display */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={element.courseListShowGPA ?? false}
              onChange={(e) => onChange({ courseListShowGPA: e.target.checked })}
              className="w-3.5 h-3.5 rounded accent-[#6C63FF]"
            />
            <span className="text-xs text-muted-foreground">Show GPA</span>
          </label>
          {element.courseListShowGPA && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">GPA:</span>
              <span className="text-sm font-bold text-[#6C63FF]">{computeGPA()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
