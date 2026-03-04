'use client'

interface Props {
  primaryColor: string
  secondaryColor: string
  number: string
  name: string
  style?: 'classic' | 'modern' | 'retro'
  signatures?: { pathData: string; color: string }[]
  width?: number
  height?: number
}

export function JerseySVG({
  primaryColor,
  secondaryColor,
  number,
  name,
  style = 'classic',
  signatures = [],
  width = 280,
  height = 340,
}: Props) {
  // Jersey shape varies by style
  const renderJersey = () => {
    switch (style) {
      case 'modern':
        return (
          <>
            {/* Body */}
            <path
              d="M60 80 L60 300 Q60 320 80 320 L200 320 Q220 320 220 300 L220 80 Z"
              fill={primaryColor}
            />
            {/* Sleeves */}
            <path
              d="M60 80 L20 120 L20 180 L60 160 Z"
              fill={primaryColor}
            />
            <path
              d="M220 80 L260 120 L260 180 L220 160 Z"
              fill={primaryColor}
            />
            {/* Collar */}
            <path
              d="M100 75 Q140 95 180 75 L180 85 Q140 105 100 85 Z"
              fill={secondaryColor}
            />
            {/* Side stripes */}
            <rect x="60" y="80" width="8" height="240" fill={secondaryColor} rx="2" />
            <rect x="212" y="80" width="8" height="240" fill={secondaryColor} rx="2" />
          </>
        )

      case 'retro':
        return (
          <>
            {/* Body */}
            <path
              d="M65 85 L65 305 Q65 315 75 315 L205 315 Q215 315 215 305 L215 85 Z"
              fill={primaryColor}
            />
            {/* Sleeves */}
            <path
              d="M65 85 L15 125 L15 185 L65 165 Z"
              fill={primaryColor}
            />
            <path
              d="M215 85 L265 125 L265 185 L215 165 Z"
              fill={primaryColor}
            />
            {/* Collar - V-neck */}
            <path
              d="M105 80 L140 115 L175 80"
              fill="none"
              stroke={secondaryColor}
              strokeWidth="6"
            />
            {/* Chest stripe */}
            <rect x="65" y="140" width="150" height="12" fill={secondaryColor} />
            <rect x="65" y="158" width="150" height="4" fill={secondaryColor} opacity="0.5" />
            {/* Sleeve bands */}
            <path d="M15 150 L65 135 L65 145 L15 160 Z" fill={secondaryColor} />
            <path d="M265 150 L215 135 L215 145 L265 160 Z" fill={secondaryColor} />
          </>
        )

      default: // classic
        return (
          <>
            {/* Body */}
            <path
              d="M65 85 L65 305 Q65 315 75 315 L205 315 Q215 315 215 305 L215 85 Z"
              fill={primaryColor}
            />
            {/* Sleeves */}
            <path
              d="M65 85 L20 120 L20 180 L65 160 Z"
              fill={primaryColor}
            />
            <path
              d="M215 85 L260 120 L260 180 L215 160 Z"
              fill={primaryColor}
            />
            {/* Collar */}
            <ellipse cx="140" cy="82" rx="40" ry="12" fill={secondaryColor} />
            <ellipse cx="140" cy="82" rx="25" ry="8" fill={primaryColor} />
            {/* Shoulder trim */}
            <path d="M65 85 L100 78" stroke={secondaryColor} strokeWidth="4" fill="none" />
            <path d="M215 85 L180 78" stroke={secondaryColor} strokeWidth="4" fill="none" />
          </>
        )
    }
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="select-none"
    >
      {renderJersey()}

      {/* Number */}
      <text
        x="140"
        y="215"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={secondaryColor}
        fontFamily="'Arial Black', 'Impact', sans-serif"
        fontSize="72"
        fontWeight="900"
        letterSpacing="-2"
      >
        {number}
      </text>

      {/* Name */}
      <text
        x="140"
        y="268"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={secondaryColor}
        fontFamily="'Arial Black', 'Impact', sans-serif"
        fontSize="16"
        fontWeight="700"
        letterSpacing="3"
      >
        {name.toUpperCase()}
      </text>

      {/* Signatures overlay */}
      {signatures.map((sig, i) => (
        <path
          key={i}
          d={sig.pathData}
          fill="none"
          stroke={sig.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      ))}
    </svg>
  )
}
