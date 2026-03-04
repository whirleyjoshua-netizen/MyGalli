import {
  Church,
  Wine,
  UtensilsCrossed,
  Music,
  Sparkles,
  Camera,
  Heart,
  Star,
  PartyPopper,
  Car,
} from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { LucideIcon } from 'lucide-react'

interface Props {
  element: CanvasElement
}

const ICON_MAP: Record<string, LucideIcon> = {
  Church,
  Wine,
  UtensilsCrossed,
  Music,
  Sparkles,
  Camera,
  Heart,
  Star,
  PartyPopper,
  Car,
}

export function PublicWeddingTimelineElement({ element }: Props) {
  const title = element.weddingTimelineTitle || 'Our Wedding Day'
  const events = element.weddingTimelineEvents || []

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-white/50 p-8 text-center">
        <Heart className="w-8 h-8 mx-auto mb-2" style={{ color: '#E8B4B8' }} />
        <p className="text-sm text-muted-foreground">No events added yet</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-white/50 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border/50 text-center">
        <h3
          className="text-xl font-semibold tracking-wide"
          style={{ fontFamily: '"Georgia", "Times New Roman", serif', color: '#2d2d2d' }}
        >
          {title}
        </h3>
        <div className="mt-2 mx-auto w-16 h-0.5 rounded-full" style={{ backgroundColor: '#E8B4B8' }} />
      </div>

      {/* Timeline */}
      <div className="px-6 py-6">
        <div className="relative">
          {/* Vertical line */}
          <div
            className="absolute left-5 top-3 bottom-3 w-px"
            style={{ backgroundColor: '#E8B4B8' }}
          />

          <div className="space-y-6">
            {events.map((evt, i) => {
              const IconComp = (evt.icon && ICON_MAP[evt.icon]) || Heart

              return (
                <div key={i} className="relative flex items-start gap-4 pl-0">
                  {/* Circle + Icon on the line */}
                  <div
                    className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2"
                    style={{
                      backgroundColor: '#FDF2F3',
                      borderColor: '#E8B4B8',
                    }}
                  >
                    <IconComp className="w-4 h-4" style={{ color: '#E8B4B8' }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span
                        className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: '#E8B4B8' }}
                      >
                        {evt.time}
                      </span>
                      <span
                        className="text-base font-semibold"
                        style={{ fontFamily: '"Georgia", "Times New Roman", serif', color: '#2d2d2d' }}
                      >
                        {evt.title}
                      </span>
                    </div>
                    {evt.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                        {evt.description}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
