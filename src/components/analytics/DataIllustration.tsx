// Decorative inline-SVG spot illustrations for the Data Overview empty-states and
// the Insights panel. Self-contained, brand-tinted, aria-hidden — presentational.

export type DataIllustrationVariant = 'device' | 'browser' | 'referrer' | 'activity' | 'sprout'

const ART: Record<DataIllustrationVariant, () => React.ReactElement> = {
  device: DeviceArt,
  browser: BrowserArt,
  referrer: ReferrerArt,
  activity: ActivityArt,
  sprout: SproutArt,
}

export function DataIllustration({
  variant,
  className = '',
}: {
  variant: DataIllustrationVariant
  className?: string
}) {
  const Art = ART[variant]
  return (
    <div aria-hidden="true" className={className}>
      <Art />
    </div>
  )
}

function DeviceArt() {
  return (
    <svg viewBox="0 0 120 90" className="h-full w-full" fill="none">
      {/* monitor */}
      <rect x="10" y="14" width="70" height="46" rx="5" className="fill-surface" stroke="currentColor" strokeOpacity="0.15" />
      <rect x="16" y="20" width="58" height="34" rx="2" className="fill-galli-aqua/10" />
      <polyline points="22,44 34,36 44,40 56,28 68,32" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="38" y="60" width="14" height="6" className="fill-galli-dark/15" />
      <rect x="30" y="66" width="30" height="4" rx="2" className="fill-galli-dark/15" />
      {/* phone */}
      <rect x="86" y="30" width="22" height="38" rx="4" className="fill-surface" stroke="currentColor" strokeOpacity="0.15" />
      <rect x="90" y="36" width="14" height="24" rx="1.5" className="fill-galli/15" />
      <Leaves />
    </svg>
  )
}

function BrowserArt() {
  return (
    <svg viewBox="0 0 120 90" className="h-full w-full" fill="none">
      <rect x="18" y="16" width="84" height="56" rx="6" className="fill-surface" stroke="currentColor" strokeOpacity="0.15" />
      <line x1="18" y1="28" x2="102" y2="28" stroke="currentColor" strokeOpacity="0.12" />
      <circle cx="26" cy="22" r="2" className="fill-galli/50" />
      <circle cx="33" cy="22" r="2" className="fill-galli-aqua/50" />
      <circle cx="40" cy="22" r="2" className="fill-galli-violet/50" />
      {/* globe */}
      <circle cx="60" cy="50" r="15" className="fill-galli-aqua/10" stroke="currentColor" strokeOpacity="0.3" />
      <ellipse cx="60" cy="50" rx="6" ry="15" stroke="currentColor" strokeOpacity="0.25" fill="none" />
      <line x1="45" y1="50" x2="75" y2="50" stroke="currentColor" strokeOpacity="0.25" />
      <Leaves />
    </svg>
  )
}

function ReferrerArt() {
  return (
    <svg viewBox="0 0 120 90" className="h-full w-full" fill="none">
      {/* signpost */}
      <rect x="56" y="24" width="6" height="46" rx="2" className="fill-galli-dark/40" />
      <path d="M20 30h38v14H20l-8-7z" className="fill-galli/25" stroke="currentColor" strokeOpacity="0.15" />
      <path d="M100 46H62v14h38l8-7z" className="fill-galli-aqua/20" stroke="currentColor" strokeOpacity="0.15" />
      <rect x="26" y="36" width="24" height="3" rx="1.5" className="fill-galli-dark/30" />
      <rect x="70" y="52" width="24" height="3" rx="1.5" className="fill-galli-dark/30" />
      <Leaves />
    </svg>
  )
}

function ActivityArt() {
  return (
    <svg viewBox="0 0 120 90" className="h-full w-full" fill="none">
      {/* ripples */}
      <ellipse cx="60" cy="64" rx="44" ry="12" className="fill-galli-aqua/10" />
      <ellipse cx="60" cy="64" rx="30" ry="8" stroke="currentColor" strokeOpacity="0.12" fill="none" />
      {/* lily pad */}
      <path d="M40 60a20 12 0 1 0 40 0 20 12 0 1 0-40 0z" className="fill-galli/30" />
      <path d="M60 60L52 52" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      {/* lotus */}
      <path d="M60 52c-4-6-4-12 0-16 4 4 4 10 0 16z" className="fill-galli-violet/40" />
      <path d="M60 52c-6-3-9-8-9-13 5 1 9 6 9 13z" className="fill-galli/45" />
      <path d="M60 52c6-3 9-8 9-13-5 1-9 6-9 13z" className="fill-galli/45" />
    </svg>
  )
}

function SproutArt() {
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full" fill="none">
      {/* pond mound */}
      <ellipse cx="60" cy="80" rx="46" ry="14" className="fill-galli-aqua/10" />
      <path d="M28 80a32 12 0 0 1 64 0z" className="fill-galli/25" />
      {/* stem + leaves */}
      <path d="M60 80V44" stroke="currentColor" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 58c-2-10-10-14-18-14 0 10 8 15 18 14z" className="fill-galli/50" />
      <path d="M60 50c2-11 10-16 20-16 0 11-9 17-20 16z" className="fill-galli/40" />
      <circle cx="60" cy="40" r="5" className="fill-galli-light" />
      <Leaves />
    </svg>
  )
}

function Leaves() {
  return (
    <g aria-hidden="true">
      <path d="M110 82c0-9-7-16-16-16 0 9 7 16 16 16z" className="fill-galli/25" />
      <path d="M94 66c5 3 9 8 11 14" stroke="white" strokeOpacity="0.4" strokeWidth="1" strokeLinecap="round" />
    </g>
  )
}
