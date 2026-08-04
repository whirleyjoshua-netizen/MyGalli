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
import { CardInspector } from './CardInspector'
import { CommentInspector } from './CommentInspector'
import { JerseyInspector } from './JerseyInspector'
import { IndexInspector } from './IndexInspector'
import { CollectionViewInspector } from './CollectionViewInspector'
import { BannerInspector } from './BannerInspector'
import { ChartInspector } from './ChartInspector'

export type Inspector = React.ComponentType<InspectorProps>
export type { InspectorProps }

// Every element with a config surface registers here; the rest fall through
// to DefaultInspector. New elements should register from day one.
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
  card: CardInspector,
  comment: CommentInspector,
  jersey: JerseyInspector,
  index: IndexInspector,
  'collection-view': CollectionViewInspector,
  banner: BannerInspector,
  chart: ChartInspector,
}

export function getInspector(type: ElementType): Inspector {
  return ELEMENT_INSPECTORS[type] ?? DefaultInspector
}
