// Decorative inline-SVG spot illustrations for Library featured app cards.
// Self-contained (no external assets), theme-safe (brand tokens via currentColor
// + explicit galli hues), and marked aria-hidden — purely presentational.

export type AppIllustrationVariant = 'vouch' | 'kollabshare'

export function AppIllustration({
  variant,
  className = '',
}: {
  variant: AppIllustrationVariant
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-galli/10 via-galli-aqua/5 to-galli-violet/10 ${className}`}
    >
      {variant === 'vouch' ? <VouchArt /> : <KollabArt />}
      <Leaves />
    </div>
  )
}

// A credibility card: avatar + verified check, star rating, content lines.
function VouchArt() {
  return (
    <svg viewBox="0 0 220 150" className="h-auto w-[78%] max-w-[240px]" fill="none">
      <rect x="18" y="20" width="184" height="110" rx="14" className="fill-surface" stroke="currentColor" strokeOpacity="0.12" />
      <circle cx="52" cy="52" r="16" className="fill-galli/25" />
      <circle cx="52" cy="47" r="6" className="fill-galli-dark/50" />
      <path d="M40 64c1.5-7 6-11 12-11s10.5 4 12 11" className="fill-galli-dark/40" />
      {/* verified badge */}
      <circle cx="66" cy="40" r="8" className="fill-galli" />
      <path d="M62.5 40l2.5 2.5 4.5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* name + role lines */}
      <rect x="80" y="42" width="70" height="7" rx="3.5" className="fill-galli-dark/25" />
      <rect x="80" y="55" width="46" height="6" rx="3" className="fill-galli-dark/10" />
      {/* stars */}
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          transform={`translate(${38 + i * 20}, 84)`}
          d="M7 0l2.1 4.3 4.7.7-3.4 3.3.8 4.7L7 10.8 2.8 13l.8-4.7L.2 5l4.7-.7z"
          className="fill-amber-400"
        />
      ))}
      {/* content lines */}
      <rect x="38" y="108" width="140" height="6" rx="3" className="fill-galli-dark/10" />
    </svg>
  )
}

// Collaborative sharing: a window with overlapping member avatars + a share node.
function KollabArt() {
  return (
    <svg viewBox="0 0 220 150" className="h-auto w-[78%] max-w-[240px]" fill="none">
      <rect x="18" y="22" width="184" height="106" rx="14" className="fill-surface" stroke="currentColor" strokeOpacity="0.12" />
      <circle cx="34" cy="38" r="3.5" className="fill-galli/40" />
      <circle cx="46" cy="38" r="3.5" className="fill-galli-aqua/40" />
      <circle cx="58" cy="38" r="3.5" className="fill-galli-violet/40" />
      <line x1="18" y1="52" x2="202" y2="52" stroke="currentColor" strokeOpacity="0.1" />
      {/* overlapping avatars */}
      {[
        { x: 74, c: 'fill-galli/30' },
        { x: 98, c: 'fill-galli-aqua/30' },
        { x: 122, c: 'fill-galli-violet/30' },
      ].map((a, i) => (
        <g key={i}>
          <circle cx={a.x} cy="86" r="15" className="fill-surface" stroke="currentColor" strokeOpacity="0.1" />
          <circle cx={a.x} cy="86" r="12" className={a.c} />
        </g>
      ))}
      {/* add / share node */}
      <circle cx="150" cy="86" r="14" className="fill-galli" />
      <path d="M150 80v12M144 86h12" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="70" y="112" width="90" height="6" rx="3" className="fill-galli-dark/10" />
    </svg>
  )
}

// Subtle pond leaves in the corner, shared by both variants.
function Leaves() {
  return (
    <svg viewBox="0 0 60 60" className="absolute bottom-0 right-0 h-14 w-14 opacity-70" fill="none" aria-hidden="true">
      <path d="M58 60c0-14-11-25-25-25 0 14 11 25 25 25z" className="fill-galli/30" />
      <path d="M60 60c0-9-7-16-16-16 0 9 7 16 16 16z" className="fill-galli/45" />
      <path d="M44 44c5 3 9 8 11 14" stroke="white" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
