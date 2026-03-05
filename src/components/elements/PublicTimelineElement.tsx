import {
  MapPin,
  Plane,
  GraduationCap,
  Trophy,
  Star,
  Flag,
  Camera,
  Heart,
  Zap,
  Sun,
  Mountain,
  Code,
  Music,
  Briefcase,
  Rocket,
  Clock,
} from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { LucideIcon } from 'lucide-react'

interface Props {
  element: CanvasElement
}

const ICON_MAP: Record<string, LucideIcon> = {
  MapPin,
  Plane,
  GraduationCap,
  Trophy,
  Star,
  Flag,
  Camera,
  Heart,
  Zap,
  Sun,
  Mountain,
  Code,
  Music,
  Briefcase,
  Rocket,
}

export function PublicTimelineElement({ element }: Props) {
  const title = element.timelineTitle || 'My Timeline'
  const color = element.timelineColor || '#39D98A'
  const events = element.timelineEvents || []

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-white/50 p-8 text-center">
        <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No events added yet</p>
      </div>
    )
  }

  // Find the index of the current event
  const currentIndex = events.findIndex((e) => e.isCurrent)

  return (
    <div className="rounded-2xl border border-border/50 bg-white/50 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border/50">
        <h3 className="text-xl font-semibold tracking-tight" style={{ color: '#2d2d2d' }}>
          {title}
        </h3>
        <div
          className="mt-2 w-12 h-0.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>

      {/* Timeline */}
      <div className="px-6 py-6">
        <div className="relative">
          {/* Vertical line */}
          <div
            className="absolute left-[11px] top-3 bottom-3 w-0.5"
            style={{ backgroundColor: color, opacity: 0.3 }}
          />

          <div className="space-y-6">
            {events.map((evt, i) => {
              const IconComp = (evt.icon && ICON_MAP[evt.icon]) || Star
              const isCurrent = evt.isCurrent
              const isFuture = currentIndex >= 0 && i > currentIndex

              return (
                <div
                  key={i}
                  className={`relative flex items-start gap-4 transition-opacity ${
                    isFuture ? 'opacity-50' : 'opacity-100'
                  }`}
                >
                  {/* Dot on line */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                        isCurrent ? 'animate-pulse' : ''
                      }`}
                      style={{
                        borderColor: color,
                        backgroundColor: isCurrent ? color : 'white',
                      }}
                    >
                      {isCurrent && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: 'white' }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 -mt-0.5">
                    {/* Date badge */}
                    <span
                      className="inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5"
                      style={{
                        color,
                        backgroundColor: `${color}15`,
                      }}
                    >
                      {evt.date}
                    </span>

                    {/* Title + Icon */}
                    <div className="flex items-center gap-2">
                      <IconComp className="w-4 h-4 flex-shrink-0" style={{ color }} />
                      <h4 className="text-base font-semibold text-foreground">
                        {evt.title}
                      </h4>
                    </div>

                    {/* Description */}
                    {evt.description && (
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        {evt.description}
                      </p>
                    )}

                    {/* Image */}
                    {evt.image && (
                      <div className="mt-2">
                        <img
                          src={evt.image}
                          alt={evt.title}
                          className="rounded-lg max-h-48 object-cover"
                        />
                      </div>
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
