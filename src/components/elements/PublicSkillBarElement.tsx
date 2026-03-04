'use client'

import { useEffect, useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicSkillBarElement({ element }: Props) {
  const name = element.skillName
  const proficiency = element.skillProficiency ?? 75
  const [animatedWidth, setAnimatedWidth] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(proficiency), 100)
    return () => clearTimeout(timer)
  }, [proficiency])

  if (!name) return null

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{name}</span>
        <span className="text-sm font-medium text-[#6C63FF]">{proficiency}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#6C63FF] to-[#8B83FF]"
          style={{
            width: `${animatedWidth}%`,
            transition: 'width 1s ease-out',
          }}
        />
      </div>
    </div>
  )
}
