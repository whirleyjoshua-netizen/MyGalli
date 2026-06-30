import { ImageResponse } from 'next/og'

// Default Open Graph / Twitter card image for every route that doesn't override it,
// so shared My Galli links show a branded preview instead of a blank box.
export const runtime = 'edge'
export const alt = 'My Galli — A living gallery of you.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #39D98A 0%, #1FB6FF 50%, #6C63FF 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 800, letterSpacing: '-2px' }}>
          My Galli
        </div>
        <div style={{ display: 'flex', fontSize: 40, marginTop: 16, opacity: 0.95 }}>
          A living gallery of you.
        </div>
      </div>
    ),
    { ...size },
  )
}
