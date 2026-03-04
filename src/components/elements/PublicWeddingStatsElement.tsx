import { Heart, Cake, MapPin, Calendar, Star, Music, Camera, Coffee, Plane, Gift } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  Heart,
  Cake,
  MapPin,
  Calendar,
  Star,
  Music,
  Camera,
  Coffee,
  Plane,
  Gift,
}

interface Props {
  element: CanvasElement
}

export function PublicWeddingStatsElement({ element }: Props) {
  const items = element.weddingStatsItems || []

  if (items.length === 0) return null

  // Use 2 columns for 1-2 items, 4 columns for 3+ items
  const gridCols = items.length <= 2
    ? 'grid-cols-2'
    : 'grid-cols-2 sm:grid-cols-4'

  return (
    <div className={`grid ${gridCols} gap-4`}>
      {items.map((item, i) => {
        const IconComp = ICON_MAP[item.icon || 'Heart'] || Heart
        return (
          <div
            key={i}
            className="flex flex-col items-center text-center rounded-2xl bg-white/80 backdrop-blur-sm border border-[#E8B4B8]/20 shadow-sm hover:shadow-md transition-shadow px-4 py-6"
          >
            <div className="w-12 h-12 rounded-full bg-[#E8B4B8]/15 flex items-center justify-center mb-3">
              <IconComp className="w-5 h-5 text-[#E8B4B8]" />
            </div>
            <span className="text-3xl font-bold text-gray-900 leading-none mb-1">
              {item.value || '0'}
            </span>
            <span className="text-sm text-gray-500 font-medium">
              {item.label || 'Stat'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
