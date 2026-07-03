'use client'

import type { ElementType } from '@/lib/types/canvas'
import { DefaultInspector, type InspectorProps } from './DefaultInspector'

export type Inspector = React.ComponentType<InspectorProps>
export type { InspectorProps }

// Elements register here as their inspectors are authored (Tasks 11–12).
export const ELEMENT_INSPECTORS: Partial<Record<ElementType, Inspector>> = {}

export function getInspector(type: ElementType): Inspector {
  return ELEMENT_INSPECTORS[type] ?? DefaultInspector
}
