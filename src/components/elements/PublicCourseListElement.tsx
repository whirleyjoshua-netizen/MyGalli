'use client'

import { useMemo } from 'react'
import { BookOpen } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

const GRADE_POINTS: Record<string, number> = {
  'A+': 4.0,
  'A': 4.0,
  'A-': 3.7,
  'B+': 3.3,
  'B': 3.0,
  'B-': 2.7,
  'C+': 2.3,
  'C': 2.0,
  'C-': 1.7,
  'D+': 1.3,
  'D': 1.0,
  'D-': 0.7,
  'F': 0.0,
}

export function PublicCourseListElement({ element }: Props) {
  const title = element.courseListTitle || 'My Courses'
  const courses = element.courseListCourses ?? []
  const showGPA = element.courseListShowGPA ?? false

  // Group courses by semester
  const semesters = useMemo(() => {
    const grouped = new Map<string, typeof courses>()
    for (const course of courses) {
      const sem = course.semester || 'Other'
      if (!grouped.has(sem)) grouped.set(sem, [])
      grouped.get(sem)!.push(course)
    }
    return Array.from(grouped.entries())
  }, [courses])

  // Calculate GPA
  const gpa = useMemo(() => {
    if (!showGPA || courses.length === 0) return null
    let totalPoints = 0
    let totalCredits = 0
    for (const course of courses) {
      const gradeUpper = course.grade?.trim().toUpperCase()
      const points = GRADE_POINTS[gradeUpper]
      const credits = parseFloat(course.credits)
      if (points != null && !isNaN(credits) && credits > 0) {
        totalPoints += points * credits
        totalCredits += credits
      }
    }
    if (totalCredits === 0) return null
    return {
      value: (totalPoints / totalCredits).toFixed(2),
      totalCredits: totalCredits.toFixed(1),
      courseCount: courses.length,
    }
  }, [courses, showGPA])

  if (courses.length === 0) return null

  const hasMultipleSemesters = semesters.length > 1

  const renderTable = (rows: typeof courses) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2" style={{ borderColor: '#6C63FF30' }}>
            <th
              className="text-left py-2.5 px-3 font-semibold text-xs uppercase tracking-wider"
              style={{ color: '#6C63FF' }}
            >
              Course
            </th>
            <th
              className="text-left py-2.5 px-3 font-semibold text-xs uppercase tracking-wider"
              style={{ color: '#6C63FF' }}
            >
              Code
            </th>
            <th
              className="text-center py-2.5 px-3 font-semibold text-xs uppercase tracking-wider"
              style={{ color: '#6C63FF' }}
            >
              Grade
            </th>
            <th
              className="text-center py-2.5 px-3 font-semibold text-xs uppercase tracking-wider"
              style={{ color: '#6C63FF' }}
            >
              Credits
            </th>
            {!hasMultipleSemesters && (
              <th
                className="text-left py-2.5 px-3 font-semibold text-xs uppercase tracking-wider"
                style={{ color: '#6C63FF' }}
              >
                Semester
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((course, i) => (
            <tr
              key={i}
              className={`border-b border-border/30 transition-colors ${
                i % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'
              }`}
            >
              <td className="py-2.5 px-3 font-medium text-foreground">
                {course.name}
              </td>
              <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs">
                {course.code}
              </td>
              <td className="py-2.5 px-3 text-center">
                <span
                  className="inline-block min-w-[2rem] text-center font-semibold text-xs px-2 py-0.5 rounded-full"
                  style={{
                    color: '#6C63FF',
                    backgroundColor: '#6C63FF15',
                  }}
                >
                  {course.grade}
                </span>
              </td>
              <td className="py-2.5 px-3 text-center text-muted-foreground">
                {course.credits}
              </td>
              {!hasMultipleSemesters && (
                <td className="py-2.5 px-3 text-muted-foreground">
                  {course.semester}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="rounded-xl border border-border/50 bg-white/50 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" style={{ color: '#6C63FF' }} />
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h3>
        </div>
        <div
          className="mt-2 w-12 h-0.5 rounded-full"
          style={{ backgroundColor: '#6C63FF' }}
        />
      </div>

      {/* Course Table(s) */}
      <div className="px-6 py-4">
        {hasMultipleSemesters ? (
          <div className="space-y-6">
            {semesters.map(([semester, semCourses]) => (
              <div key={semester}>
                <h4
                  className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
                  style={{ color: '#6C63FF' }}
                >
                  {semester}
                </h4>
                {renderTable(semCourses)}
              </div>
            ))}
          </div>
        ) : (
          renderTable(courses)
        )}
      </div>

      {/* GPA Summary */}
      {gpa && (
        <div
          className="px-6 py-4 border-t border-border/50"
          style={{ backgroundColor: '#6C63FF08' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#6C63FF20' }}
              >
                <BookOpen className="w-5 h-5" style={{ color: '#6C63FF' }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Calculated GPA
                </p>
                <p className="text-xl font-bold" style={{ color: '#6C63FF' }}>
                  {gpa.value}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    / 4.00
                  </span>
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{gpa.courseCount} courses</p>
              <p>{gpa.totalCredits} credits</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
