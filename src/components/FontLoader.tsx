'use client'

import { useEffect } from 'react'
import { loadGoogleFont } from '@/lib/fonts'
import type { Section } from '@/lib/types/canvas'

export function FontLoader({ sections }: { sections: Section[] }) {
  useEffect(() => {
    const fonts = new Set<string>()
    for (const section of sections) {
      for (const column of section.columns) {
        for (const element of column.elements) {
          if (element.fontFamily) {
            fonts.add(element.fontFamily)
          }
        }
      }
    }
    fonts.forEach((family) => loadGoogleFont(family))
  }, [sections])

  return null
}
