'use client'

import type { CanvasElement } from '@/lib/types/canvas'
import type { ElementAggregate } from '@/lib/element-aggregate'
import { BulletinPoll } from './blocks/BulletinPoll'
import { BulletinRating } from './blocks/BulletinRating'
import { BulletinShortAnswer } from './blocks/BulletinShortAnswer'
import { BulletinAcknowledgment } from './blocks/BulletinAcknowledgment'

export interface BulletinBlockProps {
  postId: string
  basePath: string
  block: CanvasElement
  results: ElementAggregate | null
  myResponse: Record<string, { type: string; answer: unknown }> | null
  onResults: (results: ElementAggregate) => void
}

export function BulletinBlock(props: BulletinBlockProps) {
  switch (props.block.type) {
    case 'poll':
      return <BulletinPoll {...props} />
    case 'rating':
      return <BulletinRating {...props} />
    case 'shortanswer':
      return <BulletinShortAnswer {...props} />
    case 'acknowledgment':
      return <BulletinAcknowledgment {...props} />
    default:
      return null
  }
}
