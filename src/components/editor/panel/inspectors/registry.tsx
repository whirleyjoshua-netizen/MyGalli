'use client'

import type { ElementType } from '@/lib/types/canvas'
import { DefaultInspector, type InspectorProps } from './DefaultInspector'
import { ImageInspector } from './ImageInspector'
import { KPIInspector } from './KPIInspector'
import { ButtonInspector } from './ButtonInspector'
import { SlideshowInspector } from './SlideshowInspector'
import { ShortAnswerInspector } from './ShortAnswerInspector'
import { RatingInspector } from './RatingInspector'
import { MCQInspector } from './MCQInspector'
import { PollInspector } from './PollInspector'
import { CodeInspector } from './CodeInspector'

export type Inspector = React.ComponentType<InspectorProps>
export type { InspectorProps }

// Elements register here as their inspectors are authored (Tasks 11–12).
export const ELEMENT_INSPECTORS: Partial<Record<ElementType, Inspector>> = {
  image: ImageInspector,
  kpi: KPIInspector,
  button: ButtonInspector,
  slideshow: SlideshowInspector,
  shortanswer: ShortAnswerInspector,
  rating: RatingInspector,
  mcq: MCQInspector,
  poll: PollInspector,
  code: CodeInspector,
}

export function getInspector(type: ElementType): Inspector {
  return ELEMENT_INSPECTORS[type] ?? DefaultInspector
}
