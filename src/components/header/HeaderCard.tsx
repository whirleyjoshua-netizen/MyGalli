import type { HeaderCardConfig } from '@/lib/types/header-card'
import { Download, Mail, Link, Phone, Github, Linkedin } from 'lucide-react'

const iconMap = {
  download: Download,
  mail: Mail,
  link: Link,
  phone: Phone,
  github: Github,
  linkedin: Linkedin,
}

const colorClasses: Record<string, Record<string, string>> = {
  blue: { solid: 'bg-blue-500 text-white hover:bg-blue-600', outline: 'border border-white/40 text-white hover:bg-white/10 backdrop-blur-sm', ghost: 'text-white hover:bg-white/10' },
  green: { solid: 'bg-green-500 text-white hover:bg-green-600', outline: 'border border-white/40 text-white hover:bg-white/10 backdrop-blur-sm', ghost: 'text-white hover:bg-white/10' },
  purple: { solid: 'bg-purple-500 text-white hover:bg-purple-600', outline: 'border border-white/40 text-white hover:bg-white/10 backdrop-blur-sm', ghost: 'text-white hover:bg-white/10' },
  orange: { solid: 'bg-orange-500 text-white hover:bg-orange-600', outline: 'border border-white/40 text-white hover:bg-white/10 backdrop-blur-sm', ghost: 'text-white hover:bg-white/10' },
  slate: { solid: 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm', outline: 'border border-white/40 text-white hover:bg-white/10 backdrop-blur-sm', ghost: 'text-white hover:bg-white/10' },
}

interface HeaderCardProps {
  config: HeaderCardConfig
}

// Single hero layout. The profile photo is positioned by `photoPosition`:
//   center-overlap → photo on top, centered column
//   left-offset    → photo left of the text
//   right-inline   → photo right of the text
//   hidden         → no photo (centered text)
export function HeaderCard({ config }: HeaderCardProps) {
  if (!config.enabled) return null

  const coverH = config.coverHeight || 280
  const photoSize = config.photoSize || 160
  const overlayOpacity = Math.max((config.overlayOpacity || 0) / 100, 0.25)

  const pos = config.photoPosition || 'center-overlap'
  const isRow = pos === 'left-offset' || pos === 'right-inline'
  const isRight = pos === 'right-inline'
  const isCenter = !isRow // center-overlap or hidden
  const showPhoto = pos !== 'hidden' && !!config.photoUrl

  const textAlignClass = config.textAlignment === 'center' ? 'text-center' : 'text-left'
  const actionsJustify = isCenter || config.textAlignment === 'center' ? 'justify-center' : 'justify-start'

  const photo = showPhoto ? (
    <div
      className={`rounded-full border-4 border-white shadow-2xl overflow-hidden bg-slate-200 ring-4 ring-white/20 ${isCenter ? 'mx-auto mb-3' : 'flex-shrink-0'}`}
      style={{ width: photoSize, height: photoSize }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={config.photoUrl} alt={config.name} className="w-full h-full object-cover" />
    </div>
  ) : null

  const info = (
    <>
      {config.name && (
        <h1 className="text-3xl font-bold text-white drop-shadow-lg">{config.name}</h1>
      )}
      {config.title && (
        <p className="text-base text-white/85 mt-1 drop-shadow">{config.title}</p>
      )}
      {config.subtitle && (
        <p className="text-sm text-white/65 mt-0.5 drop-shadow">{config.subtitle}</p>
      )}
      {config.bio && (
        <p className={`mt-2 text-sm text-white/70 max-w-xl drop-shadow ${isCenter ? 'mx-auto' : ''}`}>{config.bio}</p>
      )}
      {config.actions.length > 0 && (
        <div className={`flex items-center gap-2.5 mt-3 flex-wrap ${actionsJustify}`}>
          {config.actions.map((action) => {
            const Icon = action.icon ? iconMap[action.icon] : null
            const btnClass = colorClasses[action.color]?.[action.variant] || colorClasses.blue.solid
            return (
              <a
                key={action.id}
                href={action.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${btnClass}`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {action.label}
              </a>
            )
          })}
        </div>
      )}
    </>
  )

  return (
    <div className="relative w-full">
      {/* Cover image area */}
      <div className="relative w-full" style={{ height: coverH }}>
        <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700">
          {config.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
          )}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
            style={{ opacity: Math.max(overlayOpacity * 2, 0.6) }}
          />
        </div>

        {/* Content — pinned to bottom, peeking out below the cover */}
        <div className="absolute inset-x-0 bottom-0 z-10" style={{ transform: 'translateY(44px)' }}>
          <div className="max-w-4xl mx-auto px-6">
            {isCenter ? (
              <div className="text-center">
                {photo}
                {info}
              </div>
            ) : (
              <div className={`flex items-end gap-5 ${isRight ? 'flex-row-reverse' : ''}`}>
                {photo}
                <div className={`flex-1 min-w-0 pb-1 ${textAlignClass}`}>{info}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
