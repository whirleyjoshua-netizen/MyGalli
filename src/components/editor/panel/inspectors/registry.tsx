'use client'

import type { ElementType } from '@/lib/types/canvas'
import { DefaultInspector, type InspectorProps } from './DefaultInspector'
import { ImageInspector } from './ImageInspector'
import { KPIInspector } from './KPIInspector'
import { ButtonInspector } from './ButtonInspector'
import { SlideshowInspector } from './SlideshowInspector'

export type Inspector = React.ComponentType<InspectorProps>
export type { InspectorProps }

// Elements register here as their inspectors are authored (Tasks 11–12).
export const ELEMENT_INSPECTORS: Partial<Record<ElementType, Inspector>> = {
  image: ImageInspector,
  kpi: KPIInspector,
  button: ButtonInspector,
  slideshow: SlideshowInspector,
}

export function getInspector(type: ElementType): Inspector {
  return ELEMENT_INSPECTORS[type] ?? DefaultInspector
}
